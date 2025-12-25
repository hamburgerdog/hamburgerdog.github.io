---
title: React Hooks 深层调度与状态队列
subtitle: Hook 链表结构与更新队列原理
date: 2025-12-25 12:00:00 +0800
tags: 前端 源码
remark: 'React Hooks 的深层实现，包括 Hook 在 fiber.memoizedState 上的链表结构、更新队列的批处理机制、Hook 调用顺序检查、useReducer 的状态合并'
---

# React Hooks 深层调度与状态队列

> Hooks 是 React 16.8 引入的函数组件状态管理方案，它通过链表结构在 Fiber 节点上维护状态和副作用。
>
> 核心机制：每个 Hook 在 `fiber.memoizedState` 上形成一个链表，每次更新都会创建 Update 对象并加入队列，在渲染时按顺序处理这些更新。
>
> 这种设计保证了 Hooks 的调用顺序必须稳定，也实现了批处理和优先级调度。

## Hook 的链表结构

### 数据结构

每个 Hook 在 Fiber 节点上形成一个链表：

```ts
// Hook 结构
interface Hook {
  memoizedState: any;        // 当前状态值
  baseState: any;            // 基础状态（用于计算）
  baseQueue: Update | null;  // 基础更新队列
  queue: UpdateQueue | null; // 更新队列
  next: Hook | null;         // 下一个 Hook（链表）
}

// Update 结构
interface Update {
  lane: Lane;                // 优先级
  action: any;               // 更新函数或值
  next: Update | null;       // 下一个 Update（环形链表）
}

// UpdateQueue 结构
interface UpdateQueue {
  pending: Update | null;   // 待处理的更新（环形链表）
  lanes: Lanes;              // 所有更新的优先级
  dispatch: Dispatch | null; // dispatch 函数
  lastRenderedReducer: Reducer | null;  // 最后一次渲染的 reducer
  lastRenderedState: any;    // 最后一次渲染的状态
}
```

### 链表挂载

Hooks 链表挂载在 `fiber.memoizedState` 上：

```ts
// Fiber 节点
interface Fiber {
  memoizedState: Hook | null;  // Hooks 链表头
  // ...
}

// 示例：多个 Hooks
function Component() {
  const [count, setCount] = useState(0);      // Hook 1
  const [name, setName] = useState('');       // Hook 2
  const effect = useEffect(() => {}, []);     // Hook 3
  
  return <div>{count}</div>;
}
```

**链表结构**：

```
fiber.memoizedState
  ↓
Hook1 (useState: count)
  ├─ memoizedState: 0
  ├─ queue: UpdateQueue { pending: Update1 }
  └─ next → Hook2
      ↓
      Hook2 (useState: name)
      ├─ memoizedState: ''
      ├─ queue: UpdateQueue { pending: null }
      └─ next → Hook3
          ↓
          Hook3 (useEffect)
          ├─ memoizedState: Effect { deps: [] }
          └─ next → null
```

## useState 的实现

### 初始化

```ts
function mountState<S>(
  initialState: (() => S) | S
): [S, Dispatch<BasicStateAction<S>>] {
  // 1. 创建 Hook
  const hook = mountWorkInProgressHook();
  
  // 2. 初始化状态
  if (typeof initialState === 'function') {
    hook.memoizedState = initialState();
  } else {
    hook.memoizedState = initialState;
  }
  
  // 3. 创建更新队列
  const queue: UpdateQueue<S, BasicStateAction<S>> = {
    pending: null,
    lanes: NoLanes,
    dispatch: null,
    lastRenderedReducer: basicStateReducer,
    lastRenderedState: initialState,
  };
  hook.queue = queue;
  
  // 4. 创建 dispatch
  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
  queue.dispatch = dispatch;
  
  return [hook.memoizedState, dispatch];
}

function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,
    baseState: null,
    baseQueue: null,
    queue: null,
    next: null,
  };
  
  if (workInProgressHook === null) {
    // 第一个 Hook
    currentlyRenderingFiber.memoizedState = workInProgressHook = hook;
  } else {
    // 后续 Hook，链到上一个
    workInProgressHook = workInProgressHook.next = hook;
  }
  
  return workInProgressHook;
}
```

### 更新调度：创建 Update 并加入队列

当调用 `setState` 时，会创建一个 Update 并加入队列：

```ts
function dispatchSetState<S, A>(
  fiber: Fiber,
  queue: UpdateQueue<S, A>,
  action: A
): void {
  // 1. 获取当前优先级（根据事件类型或 Transition）
  const lane = requestUpdateLane(fiber);
  
  // 2. 创建 Update 对象
  const update: Update<S, A> = {
    lane,        // 优先级
    action,      // 更新函数或值
    next: null,  // 下一个 Update（环形链表）
  };
  
  // 3. 将 Update 加入 queue.pending（环形链表）
  const pending = queue.pending;
  if (pending === null) {
    // 第一个 Update，自己指向自己
    update.next = update;
  } else {
    // 后续 Update，插入到环形链表头部
    update.next = pending.next;
    pending.next = update;
  }
  queue.pending = update;  // 更新 pending 指针
  
  // 4. 调度更新
  const alternate = fiber.alternate;
  if (
    fiber === currentlyRenderingFiber ||
    (alternate !== null && alternate === currentlyRenderingFiber)
  ) {
    // 在渲染过程中更新（渲染阶段更新）
    // 标记需要重新渲染
    didScheduleRenderPhaseUpdateDuringThisRender = true;
  } else {
    // 正常更新，尝试优化
    if (fiber.lanes === NoLanes && (alternate === null || alternate.lanes === NoLanes)) {
      // 当前 Fiber 没有待处理的更新，可以提前计算
      const lastRenderedReducer = queue.lastRenderedReducer;
      if (lastRenderedReducer !== null) {
        try {
          const currentState: S = queue.lastRenderedState;
          const eagerState = lastRenderedReducer(currentState, action);
          // 如果状态没变，跳过更新（性能优化）
          if (is(eagerState, currentState)) {
            return;
          }
        } catch (error) {
          // 忽略错误，继续调度
        }
      }
    }
    
    // 调度更新（进入 React 调度系统）
    scheduleUpdateOnFiber(fiber, lane, eventTime);
  }
}
```

**关键点**：

1. **环形链表**：`queue.pending` 指向最后一个 Update，形成环形链表
2. **优先级标记**：每个 Update 都有 `lane`，决定处理优先级
3. **提前优化**：如果状态没变，可以跳过更新
4. **渲染阶段更新**：在渲染过程中更新会触发重新渲染

## queue 与 baseQueue：中断恢复的核心

理解 `queue` 和 `baseQueue` 的区别是理解 Hooks 中断恢复机制的关键。

### 两个队列的作用

| 队列 | 位置 | 作用 | 生命周期 |
|------|------|------|----------|
| **queue.pending** | `Hook.queue.pending` | 存储新产生的更新 | 每次渲染前清空 |
| **baseQueue** | `Hook.baseQueue` | 存储未处理完的更新（包括被跳过的） | 跨渲染保留 |

### queue.pending：新更新的临时存储

`queue.pending` 是**新产生的更新**的临时存储区：

```tsx
function Component() {
  const [count, setCount] = useState(0);
  
  function handleClick() {
    setCount(1);  // 加入 queue.pending
    setCount(2);  // 加入 queue.pending
    setCount(3);  // 加入 queue.pending
  }
}
```

**特点**：
- 每次 `setState` 都会加入 `queue.pending`
- 渲染开始时，`queue.pending` 会被合并到 `baseQueue`
- 合并后，`queue.pending` 会被清空（`queue.pending = null`）

### baseQueue：跨渲染的状态恢复

`baseQueue` 存储**未处理完的更新**，用于中断恢复：

**场景：低优先级更新被高优先级打断**

```tsx
function Component() {
  const [count, setCount] = useState(0);
  
  function handleClick() {
    // 低优先级更新
    startTransition(() => {
      setCount(1);  // TransitionLane
      setCount(2);  // TransitionLane
    });
    
    // 高优先级更新（打断上面的更新）
    setCount(10);  // DefaultLane
  }
}
```

**执行流程**：

```
第一次渲染（处理 TransitionLane）
  ↓
setCount(1) → queue.pending = Update1
setCount(2) → queue.pending = Update1 → Update2
  ↓
合并到 baseQueue: baseQueue = Update1 → Update2
  ↓
处理 baseQueue:
  ├─ Update1 (TransitionLane) → 优先级不够，跳过
  │   └─ 保存到 newBaseQueue
  └─ Update2 (TransitionLane) → 优先级不够，跳过
      └─ 保存到 newBaseQueue
  ↓
baseQueue = newBaseQueue (包含 Update1, Update2)
baseState = 0 (未处理任何更新)
memoizedState = 0
  ↓
渲染被高优先级打断
  ↓
第二次渲染（处理 DefaultLane）
  ↓
setCount(10) → queue.pending = Update3
  ↓
合并 baseQueue 和 queue.pending:
  baseQueue = Update1 → Update2 → Update3
  ↓
处理 baseQueue:
  ├─ Update1 (TransitionLane) → 优先级不够，跳过
  │   └─ 保存到 newBaseQueue
  ├─ Update2 (TransitionLane) → 优先级不够，跳过
  │   └─ 保存到 newBaseQueue
  └─ Update3 (DefaultLane) → 优先级足够，处理
      └─ newState = 10
  ↓
baseQueue = newBaseQueue (包含 Update1, Update2)
baseState = 0
memoizedState = 10
  ↓
第三次渲染（处理 TransitionLane）
  ↓
处理 baseQueue:
  ├─ Update1 (TransitionLane) → 优先级足够，处理
  │   └─ newState = reducer(10, 1) = 11
  └─ Update2 (TransitionLane) → 优先级足够，处理
      └─ newState = reducer(11, 2) = 13
  ↓
baseQueue = null (所有更新处理完)
baseState = 13
memoizedState = 13 ✅
```

### 核心机制总结

1. **queue.pending**：新更新的临时存储，每次渲染前清空
2. **baseQueue**：未处理完的更新，跨渲染保留，支持中断恢复
3. **baseState**：最后一次完整处理所有更新后的状态，作为下次计算的起点
4. **优先级跳过**：优先级不够的更新会被保存到 `baseQueue`，等待下次处理

### 更新处理流程

在渲染时，按顺序处理所有 Update：

```ts
function updateReducer<S, I, A>(
  reducer: (S, A) => S,
  initialArg: I,
  init?: (I) => S
): [S, Dispatch<A>] {
  // 1. 获取当前 Hook（从 current 树获取）
  const hook = updateWorkInProgressHook();
  const queue = hook.queue;
  const current: Hook = currentHook;
  
  // 2. 合并 queue.pending 到 baseQueue
  // 这一步是关键：把新更新和旧更新合并
  let baseQueue = current.baseQueue;
  const pendingQueue = queue.pending;
  
  if (pendingQueue !== null) {
    if (baseQueue !== null) {
      // 合并两个环形链表
      const baseFirst = baseQueue.next;
      const pendingFirst = pendingQueue.next;
      baseQueue.next = pendingFirst;
      pendingQueue.next = baseFirst;
    }
    baseQueue = pendingQueue;
    queue.pending = null;  // 清空 pending
  }
  
  // 3. 处理 baseQueue，计算新状态
  if (baseQueue !== null) {
    const first = baseQueue.next;
    let newState = current.baseState;  // 从 baseState 开始计算
    let newBaseState = null;
    let newBaseQueueFirst = null;
    let newBaseQueueLast = null;
    let update = first;
    
    // 遍历环形链表
    do {
      const updateLane = update.lane;
      
      if (!isSubsetOfLanes(renderLanes, updateLane)) {
        // 优先级不够，跳过这个 Update
        // 保存到 newBaseQueue，等待下次处理
        const clone: Update<S, A> = {
          lane: updateLane,
          action: update.action,
          next: null,
        };
        if (newBaseQueueLast === null) {
          newBaseQueueFirst = newBaseQueueLast = clone;
          newBaseState = newState;  // 记录当前状态作为 baseState
        } else {
          newBaseQueueLast = newBaseQueueLast.next = clone;
        }
        // 标记 Fiber 需要再次处理这些优先级
        currentlyRenderingFiber.lanes = mergeLanes(
          currentlyRenderingFiber.lanes,
          updateLane
        );
      } else {
        // 优先级足够，处理这个 Update
        // 如果之前有跳过的更新，需要先克隆已处理的更新
        if (newBaseQueueLast !== null) {
          const clone: Update<S, A> = {
            lane: NoLane,  // 已处理，移除优先级
            action: update.action,
            next: null,
          };
          newBaseQueueLast = newBaseQueueLast.next = clone;
        }
        
        // 执行 reducer，计算新状态
        const action = update.action;
        if (typeof action === 'function') {
          newState = reducer(newState, action(newState));
        } else {
          newState = reducer(newState, action);
        }
      }
      update = update.next;
    } while (update !== null && update !== first);
    
    // 4. 更新 baseQueue 和 baseState
    if (newBaseQueueLast === null) {
      // 所有更新都处理完了
      newBaseState = newState;
    } else {
      // 还有未处理的更新，保存到 baseQueue
      newBaseQueueLast.next = newBaseQueueFirst;
    }
    
    // 5. 更新 Hook 状态
    hook.memoizedState = newState;      // 当前状态
    hook.baseState = newBaseState;      // 基础状态
    hook.baseQueue = newBaseQueueLast;  // 未处理的更新队列
    queue.lastRenderedState = newState;
  }
  
  const dispatch: Dispatch<A> = queue.dispatch;
  return [hook.memoizedState, dispatch];
}
```

**关键点**：

1. **合并机制**：`queue.pending` 合并到 `baseQueue`，保证更新顺序
2. **优先级过滤**：优先级不够的更新保存到 `baseQueue`，等待下次处理
3. **状态计算**：从 `baseState` 开始，按顺序处理所有更新
4. **中断恢复**：`baseQueue` 和 `baseState` 保证中断后能正确恢复

## 批处理机制：一次渲染处理多个更新

React 会将同一事件中的多个 `setState` 批处理，只触发一次渲染。

### 多个 setState 的批处理

```tsx
function Component() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');
  
  function handleClick() {
    setCount(1);  // Update 1
    setCount(2);  // Update 2
    setCount(3);  // Update 3
    setName('a'); // Update 4
  }
  
  return <button onClick={handleClick}>Click</button>;
}
```

**执行流程**：

```
1. 事件触发阶段（收集更新）
handleClick 执行
  ↓
setCount(1)
  ├─ 创建 Update1 { action: 1, lane: DefaultLane }
  └─ queue.pending = Update1 (环形: Update1 → Update1)
  ↓
setCount(2)
  ├─ 创建 Update2 { action: 2, lane: DefaultLane }
  └─ 插入环形链表: Update1 → Update2 → Update1
     queue.pending = Update2
  ↓
setCount(3)
  ├─ 创建 Update3 { action: 3, lane: DefaultLane }
  └─ 插入环形链表: Update1 → Update2 → Update3 → Update1
     queue.pending = Update3
  ↓
setName('a')
  ├─ 创建 Update4 { action: 'a', lane: DefaultLane }
  └─ 加入 name Hook 的 queue.pending

2. 渲染阶段（处理更新）
事件结束，开始渲染
  ↓
updateReducer (count Hook)
  ├─ 合并 queue.pending 到 baseQueue
  ├─ 处理 baseQueue:
  │   ├─ Update1: reducer(0, 1) → 1
  │   ├─ Update2: reducer(1, 2) → 2
  │   └─ Update3: reducer(2, 3) → 3
  └─ 最终状态: count = 3 ✅
  ↓
updateReducer (name Hook)
  ├─ 处理 Update4
  └─ 最终状态: name = 'a' ✅
  ↓
一次渲染，两个状态都更新 ✅
```

**批处理的关键**：

1. **同一事件**：在同一个事件处理器中的更新会被批处理
2. **同一优先级**：相同优先级的更新会被合并处理
3. **环形链表**：所有更新形成一个环形链表，保证顺序
4. **一次渲染**：多个更新只触发一次渲染，提高性能

### 函数式更新的批处理

函数式更新可以基于最新状态计算，适合连续更新：

```tsx
function Component() {
  const [count, setCount] = useState(0);
  
  function handleClick() {
    setCount(c => c + 1);  // Update 1: c => c + 1
    setCount(c => c + 1);  // Update 2: c => c + 1
    setCount(c => c + 1);  // Update 3: c => c + 1
  }
  
  return <button onClick={handleClick}>Count: {count}</button>;
}
```

**执行流程**：

```
handleClick 执行
  ↓
三个 setCount 创建三个 Update（都是函数）
  ↓
渲染时处理（按顺序执行函数）
  ├─ Update1: reducer(0, c => c + 1)
  │   └─ action(0) = 1 → newState = 1
  ├─ Update2: reducer(1, c => c + 1)
  │   └─ action(1) = 2 → newState = 2
  └─ Update3: reducer(2, c => c + 1)
      └─ action(2) = 3 → newState = 3
  ↓
最终状态: count = 3 ✅
```

**函数式更新的优势**：

- **基于最新状态**：每次更新都基于前一次的结果
- **避免闭包陷阱**：不依赖外部变量
- **适合连续更新**：多次更新会累积效果

## useReducer 的状态合并

`useReducer` 的实现与 `useState` 类似，但使用自定义 reducer：

```ts
function updateReducer<S, I, A>(
  reducer: (S, A) => S,
  initialArg: I,
  init?: (I) => S
): [S, Dispatch<A>] {
  // 处理逻辑与 useState 相同
  // 区别在于使用传入的 reducer 而不是 basicStateReducer
}

// basicStateReducer（useState 使用）
function basicStateReducer<S>(state: S, action: BasicStateAction<S>): S {
  return typeof action === 'function' ? action(state) : action;
}
```

**useReducer 的优势**：

1. **复杂状态逻辑**：适合多个子值的复杂 state
2. **状态合并**：reducer 可以合并多个更新
3. **可测试性**：纯函数，易于测试

```tsx
function reducer(state, action) {
  switch (action.type) {
    case 'increment':
      return { count: state.count + 1 };
    case 'decrement':
      return { count: state.count - 1 };
    case 'reset':
      return { count: 0 };
    default:
      return state;
  }
}

function Component() {
  const [state, dispatch] = useReducer(reducer, { count: 0 });
  
  function handleClick() {
    dispatch({ type: 'increment' });
    dispatch({ type: 'increment' });
    dispatch({ type: 'increment' });
  }
  
  return <button onClick={handleClick}>Count: {state.count}</button>;
}
```

## Hook 调用顺序检查

Hooks 必须在每次渲染时以**相同的顺序**调用，这是 Hooks 的核心规则。

### 链表访问机制

React 通过链表顺序访问 Hooks，每次渲染必须按相同顺序：

```ts
function updateWorkInProgressHook(): Hook {
  let nextCurrentHook: Hook | null;
  
  // 1. 从 current 树获取对应的 Hook
  if (currentHook === null) {
    // 第一个 Hook，从 current 树获取
    const current = currentlyRenderingFiber.alternate;
    if (current !== null) {
      nextCurrentHook = current.memoizedState;  // 获取 current 树的第一个 Hook
    } else {
      nextCurrentHook = null;  // 首次渲染，没有 current 树
    }
  } else {
    // 后续 Hook，沿着链表向下
    nextCurrentHook = currentHook.next;
  }
  
  // 2. 从 workInProgress 树获取对应的 Hook
  let nextWorkInProgressHook: Hook | null;
  if (workInProgressHook === null) {
    // 第一个 Hook
    nextWorkInProgressHook = currentlyRenderingFiber.memoizedState;
  } else {
    // 后续 Hook，沿着链表向下
    nextWorkInProgressHook = workInProgressHook.next;
  }
  
  // 3. 复用或创建 Hook
  if (nextWorkInProgressHook !== null) {
    // workInProgress 树已有 Hook，复用
    workInProgressHook = nextWorkInProgressHook;
    currentHook = nextCurrentHook;
  } else {
    // workInProgress 树没有 Hook，需要创建
    if (nextCurrentHook === null) {
      // current 树也没有，说明 Hook 数量增加了
      throw new Error('Rendered more hooks than during the previous render.');
    }
    
    // 从 current 树复制 Hook
    currentHook = nextCurrentHook;
    const newHook: Hook = {
      memoizedState: currentHook.memoizedState,
      baseState: currentHook.baseState,
      baseQueue: currentHook.baseQueue,
      queue: currentHook.queue,
      next: null,
    };
    
    // 链到 workInProgress 树
    if (workInProgressHook === null) {
      currentlyRenderingFiber.memoizedState = workInProgressHook = newHook;
    } else {
      workInProgressHook = workInProgressHook.next = newHook;
    }
  }
  
  return workInProgressHook;
}
```

### 错误示例：条件调用

```tsx
function Component({ condition }) {
  const [count, setCount] = useState(0);  // Hook 1
  
  if (condition) {
    const [name, setName] = useState('');  // ❌ 错误：条件调用（Hook 2）
  }
  
  const [age, setAge] = useState(0);  // Hook 3
  
  return <div>{count}</div>;
}
```

**为什么错误？**

Hooks 通过链表存储，每次渲染必须按相同顺序访问：

```
第一次渲染（condition = true）:
  Hook1 (count) → Hook2 (name) → Hook3 (age)
  
第二次渲染（condition = false）:
  Hook1 (count) → Hook3 (age)
  // Hook2 被跳过，但 Hook3 仍然访问的是原来 Hook2 的位置
  // 导致状态错乱：age 的值实际上是 name 的值
```

**正确的做法**：

```tsx
// ✅ 正确：所有 Hooks 都在顶层调用
function Component({ condition }) {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');
  const [age, setAge] = useState(0);
  
  // 使用条件逻辑，而不是条件调用
  return (
    <div>
      {count}
      {condition && <div>{name}</div>}
      {age}
    </div>
  );
}
```

## useEffect 的依赖检查

`useEffect` 通过依赖数组决定是否重新执行，这是性能优化的关键。

### 依赖比较机制

```ts
function updateEffect(
  create: () => (() => void) | void,
  deps: Array<mixed> | void | null
): void {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  let effect: Effect = hook.memoizedState;
  
  if (currentHook !== null) {
    // 有上一次的 effect，比较依赖
    const prevEffect = currentHook.memoizedState;
    const prevDeps = prevEffect.deps;
    
    if (nextDeps !== null) {
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        // 依赖没变，跳过执行（性能优化）
        pushEffect(HookPassive, create, undefined, nextDeps);
        return;
      }
    }
  }
  
  // 依赖变了，标记需要执行
  currentlyRenderingFiber.flags |= PassiveEffect;
  hook.memoizedState = pushEffect(
    HookPassive | HookHasEffect,  // 标记有副作用
    create,
    undefined,
    nextDeps
  );
}

// 依赖比较：使用 Object.is 进行浅比较
function areHookInputsEqual(
  nextDeps: Array<mixed>,
  prevDeps: Array<mixed> | null
): boolean {
  if (prevDeps === null) {
    return false;  // 首次渲染，需要执行
  }
  
  // 逐个比较依赖项
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (is(nextDeps[i], prevDeps[i])) {  // Object.is 比较
      continue;
    }
    return false;  // 有依赖变了
  }
  
  return true;  // 所有依赖都没变
}
```

### 依赖检查的关键点

1. **浅比较**：使用 `Object.is` 进行浅比较，对象引用变化才会触发
2. **性能优化**：依赖没变时跳过执行，减少不必要的副作用
3. **标记机制**：依赖变化时标记 `HookHasEffect`，在 Commit 阶段执行

**示例**：

```tsx
function Component() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');
  
  // 依赖没变，不会重新执行
  useEffect(() => {
    console.log('count changed');
  }, [count]);  // count 没变，跳过
  
  // 依赖变了，会重新执行
  useEffect(() => {
    console.log('name changed');
  }, [name]);  // name 变了，执行
}
```

## 总结

Hooks 的深层实现体现了 React 的设计哲学，核心机制包括：

### 数据结构

1. **链表结构**：Hooks 通过链表在 `fiber.memoizedState` 上存储，保证顺序访问
2. **环形链表**：每个 Hook 的更新队列（`queue.pending`）是环形链表，方便插入和遍历
3. **双队列机制**：`queue.pending` 存储新更新，`baseQueue` 存储未处理完的更新

### 更新机制

1. **更新创建**：每次 `setState` 创建 Update 对象，加入 `queue.pending`
2. **队列合并**：渲染时将 `queue.pending` 合并到 `baseQueue`
3. **优先级处理**：按优先级处理更新，优先级不够的保存到 `baseQueue` 等待
4. **状态计算**：从 `baseState` 开始，按顺序处理所有更新

### 中断恢复

1. **baseQueue 保存**：未处理完的更新保存在 `baseQueue`，跨渲染保留
2. **baseState 记录**：最后一次完整处理后的状态作为 `baseState`
3. **恢复机制**：中断后从 `baseState` 和 `baseQueue` 恢复，保证状态一致性

### 性能优化

1. **批处理**：同一事件中的多个更新会被批处理，只触发一次渲染
2. **提前优化**：状态没变时可以跳过更新
3. **依赖检查**：`useEffect` 通过依赖比较跳过不必要的执行

### 核心规则

1. **调用顺序**：必须保证每次渲染时 Hooks 的调用顺序一致
2. **条件调用**：不能在条件语句中调用 Hooks
3. **函数式更新**：适合连续更新，基于最新状态计算

这种设计让函数组件能够拥有类组件的能力，同时支持并发渲染、优先级调度等高级特性，保持简洁和高效。

