---
title: React 高级并发特性
subtitle: Concurrent Mode 与 Transitions
date: 2025-12-26 12:00:00 +0800
tags: 前端 源码
remark: 'React 高级并发特性，包括 Concurrent Mode 整体策略、startTransition/useDeferredValue/flushSync 的作用与调度区别、时间分片如何提高用户体验'
---

# React 高级并发特性

> React 18 引入了 Concurrent Mode（并发模式），让 React 能够中断低优先级的渲染工作，优先处理高优先级的用户交互。
>
> 核心特性：**时间分片**（Time Slicing）、**优先级调度**（Priority Scheduling）、**可中断渲染**（Interruptible Rendering）。
>
> 通过 `startTransition`、`useDeferredValue`、`Suspense` 等 API，开发者可以控制更新的优先级，提升用户体验。

## Concurrent Mode 整体策略

### 什么是并发？

并发不是并行。并发是**任务可以交替执行**，并行是**任务同时执行**。

React 的并发渲染：

```bash
传统渲染（同步）:
  渲染任务 A ──────────────┐
                     ├─ 阻塞主线程
  用户交互 ────────────────┘  无法响应

并发渲染:
  渲染任务 A ──┐
            ├─ 交替执行
  用户交互 ────┘  可以中断渲染，响应交互
```

### Concurrent Mode 的核心能力

1. **可中断渲染**：低优先级任务可以被高优先级任务打断
2. **时间分片**：将长任务分割成多个小任务，每次执行一小段时间
3. **优先级调度**：根据任务重要性决定执行顺序
4. **状态一致性**：保证最终状态的一致性，不会出现中间状态

### 启用 Concurrent Mode

```tsx
// React 18 默认启用并发特性
import { createRoot } from 'react-dom/client';

const root = createRoot(document.getElementById('root'));
root.render(<App />);

// 如果需要同步渲染（兼容旧代码）
import { render } from 'react-dom';

render(<App />, document.getElementById('root')); // 同步模式
```

## startTransition：标记非紧急更新

`startTransition` 用于标记**非紧急更新**，这些更新可以被高优先级任务打断。

### 基本用法

```tsx
import { startTransition, useState } from 'react';

function App() {
  const [input, setInput] = useState('');
  const [list, setList] = useState([]);

  function handleChange(e) {
    const value = e.target.value;

    // 高优先级：立即更新输入框
    setInput(value);

    // 低优先级：可以被打断
    startTransition(() => {
      setList(searchItems(value));
    });
  }
  return (
    <div>
      <input value={input} onChange={handleChange} />
      <List items={list} />
    </div>
  );
}
```

### 实现原理

```ts
function startTransition(scope: () => void): void {
  const prevTransition = ReactCurrentBatchConfig.transition;
  ReactCurrentBatchConfig.transition = {};
  try {
    scope();
  } finally {
    ReactCurrentBatchConfig.transition = prevTransition;
  }
}

// 在调度更新时检查
function requestUpdateLane(fiber: Fiber): Lane {
  const mode = fiber.mode;

  if ((mode & ConcurrentMode) === NoMode) {
    return SyncLane; // 同步模式
  }

  // 检查是否在 Transition 中
  if (isTransitionRequest()) {
    return requestTransitionLane(); // Transition 优先级
  }

  // 根据事件类型决定优先级
  const currentUpdatePriority = getCurrentUpdatePriority();
  if (currentUpdatePriority !== NoLane) {
    return currentUpdatePriority;
  }

  return DefaultLane; // 默认优先级
}

function isTransitionRequest(): boolean {
  return ReactCurrentBatchConfig.transition !== null;
}
```

### 使用场景

| 场景           | 高优先级更新 | Transition 更新 |
| -------------- | ------------ | --------------- |
| **搜索框**     | 输入框值     | 搜索结果列表    |
| **标签页切换** | 当前标签     | 新标签内容      |
| **数据加载**   | 加载状态     | 数据内容        |

### useTransition Hook

`useTransition` 提供 `isPending` 状态，表示 Transition 是否在进行中：

```tsx
import { useTransition } from 'react';

function App() {
  const [isPending, startTransition] = useTransition();
  const [input, setInput] = useState('');
  const [list, setList] = useState([]);

  function handleChange(e) {
    const value = e.target.value;
    setInput(value);

    startTransition(() => {
      setList(searchItems(value));
    });
  }
  return (
    <div>
      <input value={input} onChange={handleChange} />
      {isPending && <Spinner />}
      <List items={list} />
    </div>
  );
}
```

**实现原理**：

```ts
function useTransition(): [boolean, (callback: () => void) => void] {
  const [isPending, setIsPending] = useState(false);

  const startTransition = useCallback((callback: () => void) => {
    setIsPending(true);

    // 使用 Transition 优先级
    ReactCurrentBatchConfig.transition = {};

    try {
      callback();
    } finally {
      ReactCurrentBatchConfig.transition = null;
      // 延迟设置 isPending 为 false
      scheduleCallback(NormalPriority, () => {
        setIsPending(false);
      });
    }
  }, []);
  return [isPending, startTransition];
}
```

## useDeferredValue：延迟值更新

`useDeferredValue` 用于**延迟更新一个值**，让高优先级更新先执行。

### 基本用法

```tsx
import { useDeferredValue, useState } from 'react';

function App() {
  const [input, setInput] = useState('');
  const deferredInput = useDeferredValue(input);

  // input 立即更新（高优先级）
  // deferredInput 延迟更新（低优先级）

  return (
    <div>
      <input value={input} onChange={(e) => setInput(e.target.value)} />
      <ExpensiveComponent value={deferredInput} />
    </div>
  );
}
```

### 实现原理

```ts
function useDeferredValue<T>(value: T): T {
  const [prevValue, setPrevValue] = useState(value);
  const prevValueRef = useRef(value);
  useEffect(() => {
    // 使用 Transition 优先级更新
    startTransition(() => {
      setPrevValue(value);
      prevValueRef.current = value;
    });
  }, [value]);
  // 如果值没变，返回旧值（延迟更新）
  if (is(value, prevValueRef.current)) {
    return prevValue;
  }
  return prevValueRef.current;
}
```

### 与 startTransition 的区别

| 特性         | startTransition | useDeferredValue |
| ------------ | --------------- | ---------------- |
| **使用方式** | 包装更新函数    | 包装值           |
| **适用场景** | 控制更新函数    | 控制单个值       |
| **灵活性**   | 更灵活          | 更简单           |

```tsx
// startTransition：控制更新
function handleChange(e) {
  setInput(e.target.value);
  startTransition(() => {
    setList(searchItems(e.target.value));
  });
}

// useDeferredValue：控制值
const deferredInput = useDeferredValue(input);
useEffect(() => {
  setList(searchItems(deferredInput));
}, [deferredInput]);
```

## flushSync：强制同步更新

`flushSync` 用于**强制同步更新**，立即执行，不可中断。

### 基本用法

```tsx
import { flushSync } from 'react-dom';

function App() {
  const [count, setCount] = useState(0);
  const [urgent, setUrgent] = useState(false);

  function handleClick() {
    setCount(count + 1); // 异步更新

    flushSync(() => {
      setUrgent(true); // 同步更新，立即执行
    });

    // urgent 已经更新完成
    console.log(urgent); // true
  }

  return (
    <div>
      <button onClick={handleClick}>Click</button>
      {urgent && <Alert />}
      <div>Count: {count}</div>
    </div>
  );
}
```

### 实现原理

```ts
function flushSync<R>(fn: () => R): R {
  const prevExecutionContext = executionContext;
  executionContext |= BatchedContext;

  const prevTransition = ReactCurrentBatchConfig.transition;
  const previousPriority = getCurrentUpdatePriority();

  try {
    ReactCurrentBatchConfig.transition = null;
    setCurrentUpdatePriority(DiscreteEventPriority); // 同步优先级

    if (fn) {
      return fn();
    } else {
      return undefined;
    }
  } finally {
    setCurrentUpdatePriority(previousPriority);
    ReactCurrentBatchConfig.transition = prevTransition;
    executionContext = prevExecutionContext;
    // 立即执行同步回调
    if ((executionContext & (RenderContext | CommitContext)) === NoContext) {
      flushSyncCallbacks();
    }
  }
}
```

### 使用场景

| 场景             | 推荐               | 不推荐       |
| ---------------- | ------------------ | ------------ |
| **测量 DOM**     | ✅ useLayoutEffect | ❌ flushSync |
| **第三方库集成** | ✅ flushSync       | -            |
| **紧急更新**     | ✅ flushSync       | -            |
| **普通更新**     | ❌ flushSync       | ✅ 正常更新  |

## Suspense 与并发渲染

`Suspense` 让组件可以"等待"异步操作完成，在等待期间显示 fallback。

### 基本用法

```tsx
import { Suspense, lazy } from 'react';

const LazyComponent = lazy(() => import('./LazyComponent'));

function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <LazyComponent />
    </Suspense>
  );
}
```

### 并发特性

`Suspense` 与并发渲染结合，支持**可中断的数据获取**：

```tsx
function App() {
  const [tab, setTab] = useState('home');
  return (
    <div>
      <Tabs value={tab} onChange={setTab} />
      <Suspense fallback={<TabSkeleton />}>
        <TabContent tab={tab} />
      </Suspense>
    </div>
  );
}

function TabContent({ tab }) {
  // 如果数据还没加载完，会抛出 Promise
  const data = use(fetchTabData(tab));
  return <div>{data.content}</div>;
}
```

**执行流程**：

```js
用户切换标签
  ↓
setTab('profile')
  ↓
开始渲染 TabContent('profile')
  ↓
use(fetchTabData('profile')) 抛出 Promise
  ↓
Suspense 捕获，显示 fallback
  ↓
数据加载完成
  ↓
重新渲染 TabContent('profile')
  ↓
显示内容
```

### use Hook

React 19 引入的 `use` Hook，用于读取 Promise 或 Context：

```ts
function use<T>(promise: Promise<T>): T {
  if (promise.status === 'pending') {
    // Promise 还在 pending，抛出给 Suspense
    throw promise;
  } else if (promise.status === 'fulfilled') {
    // Promise 已完成，返回结果
    return promise.value;
  } else {
    // Promise 被拒绝，抛出错误
    throw promise.reason;
  }
}
```

## 时间分片如何提高 UX

### 问题：长任务阻塞

```tsx
// 问题：渲染大量数据会阻塞主线程
function App() {
  const [items] = useState(generateLargeList(10000));

  return (
    <div>
      {items.map((item) => (
        <Item key={item.id} data={item} />
      ))}
    </div>
  );
}
```

**问题表现**：
- 输入框无法响应
- 动画卡顿
- 页面假死

### 解决方案：时间分片

```tsx
// 解决方案：使用 Transition 降低优先级
function App() {
  const [input, setInput] = useState('');
  const [items, setItems] = useState([]);

  function handleChange(e) {
    const value = e.target.value;
    setInput(value); // 高优先级：立即更新

    startTransition(() => {
      setItems(searchItems(value)); // 低优先级：可以被打断
    });
  }

  return (
    <div>
      <input value={input} onChange={handleChange} />
      <List items={items} />
    </div>
  );
}
```

**效果**：
- 输入框立即响应 ✅
- 动画流畅 ✅
- 页面不卡顿 ✅

### 时间分片的实现

时间分片的核心是 `workLoopConcurrent` 和 `shouldYield`，它们配合 Scheduler 的调度机制工作：

```ts
// Scheduler 的调度入口
function performWorkUntilDeadline() {
  if (scheduledHostCallback !== null) {
    const currentTime = getCurrentTime();

    // 1. 更新 deadline（时间片的截止时间）
    deadline = currentTime + frameInterval; // 5ms 时间片

    // 2. 标记是否有剩余时间
    let hasTimeRemaining = true;

    try {
      // 3. 执行工作循环
      hasTimeRemaining = scheduledHostCallback(hasTimeRemaining, currentTime);
    } finally {
      if (hasTimeRemaining) {
        // 4. 还有工作要做，继续调度下一个时间片
        schedulePerformWorkUntilDeadline();
      } else {
        // 5. 工作完成，清理
        scheduledHostCallback = null;
        deadline = -1;
      }
    }
  }
}

// 工作循环
function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    workInProgress = performUnitOfWork(workInProgress);
  }
}

function shouldYield(): boolean {
  // 检查当前时间片是否用完
  if (deadline === null) {
    return false; // 同步模式，不中断
  }

  // 检查是否还有剩余时间
  if (deadline.timeRemaining() > timeHeuristicForUnitOfWork) {
    return false; // 还有时间，继续工作
  }

  // 检查是否有待处理的用户输入
  if (enableIsInputPending) {
    if (isInputPending()) {
      return true; // 有输入，立即让出控制权
    }
    // 如果时间还没超过连续输入间隔，继续工作
    if (deadline.timeRemaining() > 0) {
      return false;
    }
  }

  // 时间用完，让出控制权
  return true;
}
```

### startTime 的更新时机

**关键点**：`startTime` 不是在 `shouldYield` 中更新的，而是在每次时间片开始时更新的。

**执行流程**：

```jsx
1. 首次调度
performWorkUntilDeadline 被调用
  ├─ currentTime = getCurrentTime()  // 例如：1000ms
  ├─ deadline = currentTime + 5ms = 1005ms
  └─ 执行 workLoopConcurrent
      └─ shouldYield() 检查 deadline.timeRemaining()
          └─ 如果时间用完，返回 true

2. 时间片用完，让出控制权
workLoopConcurrent 退出（workInProgress !== null）
  ↓
performWorkUntilDeadline 的 finally 块
  ├─ hasTimeRemaining = true（还有工作）
  └─ schedulePerformWorkUntilDeadline()  // 调度下一个时间片

3. 下一个时间片开始
performWorkUntilDeadline 再次被调用
  ├─ currentTime = getCurrentTime()  // 例如：1006ms（新的开始时间）
  ├─ deadline = currentTime + 5ms = 1011ms  // 新的截止时间
  └─ 继续执行 workLoopConcurrent
      └─ 从上次中断的地方继续（workInProgress 保存了状态）
```

**重要**：每次 `performWorkUntilDeadline` 被调用时，都会重新计算 `deadline`，这就是"时间片"的概念。`deadline.timeRemaining()` 会返回剩余时间，而不是使用 `startTime`。

### 如果没有打断，如何执行？

如果一直没有其他任务打断，React 会**连续执行多个时间片**，直到完成所有工作：

```jsx
时间片 1（0-5ms）
  ├─ performWorkUntilDeadline 开始
  ├─ deadline = 5ms
  ├─ workLoopConcurrent 执行
  ├─ 5ms 后，shouldYield() 返回 true
  └─ 调度下一个时间片

时间片 2（5-10ms）
  ├─ performWorkUntilDeadline 开始
  ├─ deadline = 10ms
  ├─ workLoopConcurrent 继续（从上次中断的地方）
  ├─ 5ms 后，shouldYield() 返回 true
  └─ 调度下一个时间片

时间片 3（10-15ms）
  ├─ performWorkUntilDeadline 开始
  ├─ deadline = 15ms
  ├─ workLoopConcurrent 继续
  ├─ 工作完成（workInProgress === null）
  └─ hasTimeRemaining = false，不再调度

结果：连续执行了 3 个时间片，完成了所有工作
```

**关键机制**：

1. **自动续接**：每个时间片结束后，如果没有更高优先级的任务，会自动调度下一个时间片
2. **状态保存**：`workInProgress` 保存了当前处理的节点，下次从中断处继续
3. **完成检测**：当 `workInProgress === null` 时，表示工作完成，不再调度

**实际代码逻辑**：

```ts
function flushWork(hasTimeRemaining: boolean, initialTime: number) {
  // 1. 标记开始时间（用于性能分析）
  isHostCallbackScheduled = false;

  // 2. 执行工作循环
  let currentTime = initialTime;
  let currentTask = peek(taskQueue);

  while (currentTask !== null) {
    // 3. 检查时间片是否用完
    if (currentTask.expirationTime > currentTime && (!hasTimeRemaining || shouldYieldToHost())) {
      // 时间用完了，退出循环
      break;
    }

    // 4. 执行任务
    const callback = currentTask.callback;
    if (callback !== null) {
      currentTask.callback = null;
      const didUserCallbackTimeout = currentTask.expirationTime <= currentTime;
      const continuationCallback = callback(didUserCallbackTimeout);

      if (typeof continuationCallback === 'function') {
        // 任务未完成，保存 continuation
        currentTask.callback = continuationCallback;
      } else {
        // 任务完成，移除
        pop(taskQueue);
      }
    } else {
      pop(taskQueue);
    }

    // 5. 继续下一个任务
    currentTask = peek(taskQueue);
  }

  // 6. 返回是否还有工作
  if (currentTask !== null) {
    return true; // 还有工作，继续调度
  } else {
    return false; // 工作完成
  }
}
```

**总结**：

1. **startTime 更新**：每次 `performWorkUntilDeadline` 调用时，都会重新计算 `deadline`（相当于更新开始时间）
2. **持续执行**：如果没有打断，会连续执行多个时间片，每个时间片 5ms，直到完成所有工作
3. **自动调度**：每个时间片结束后，如果还有工作，会自动调度下一个时间片
4. **状态保存**：`workInProgress` 保存了中断位置，保证可以无缝续接

## 实际场景示例

### 场景：标签页切换

```tsx
function Tabs() {
  const [activeTab, setActiveTab] = useState('home');
  const [isPending, startTransition] = useTransition();

  function handleTabChange(tab) {
    // 高优先级：立即切换标签
    setActiveTab(tab);

    // 低优先级：加载内容可以被打断
    startTransition(() => {
      loadTabContent(tab);
    });
  }
  return (
    <div>
      <TabList activeTab={activeTab} onChange={handleTabChange} />
      {isPending && <TabSkeleton />}
      <TabContent tab={activeTab} />
    </div>
  );
}
```

**从调度到 performUnitOfWork 的完整调用链**：

```jsx
1. 用户交互层
用户点击标签
  ↓
handleTabChange('profile') 执行
  ↓

2. 状态更新层（高优先级：DefaultLane）
setActiveTab('profile')
  ├─ dispatchSetState(fiber, queue, 'profile')
  │   ├─ requestUpdateLane(fiber) → DefaultLane
  │   ├─ 创建 Update { lane: DefaultLane, action: 'profile' }
  │   ├─ 加入 queue.pending（环形链表）
  │   └─ scheduleUpdateOnFiber(fiber, DefaultLane, eventTime)
  │       ├─ markRootUpdated(root, DefaultLane, eventTime)
  │       │   └─ root.pendingLanes |= DefaultLane
  │       └─ ensureRootIsScheduled(root, eventTime)
  │           ├─ getNextLanes(root, ...) → DefaultLane
  │           ├─ scheduleCallback(NormalPriority, performConcurrentWorkOnRoot)
  │           │   ├─ push(taskQueue, task)
  │           │   └─ requestHostCallback(flushWork)
  │           │       └─ schedulePerformWorkUntilDeadline()  // MessageChannel 异步
  │           └─ root.callbackNode = task
  ↓

3. Transition 更新层（低优先级：TransitionLane）
startTransition(() => {
  loadTabContent('profile')
})
  ├─ ReactCurrentBatchConfig.transition = {}
  ├─ loadTabContent('profile') 执行
  │   └─ setState(...) → TransitionLane
  │       └─ scheduleUpdateOnFiber(fiber, TransitionLane, eventTime)
  │           ├─ markRootUpdated(root, TransitionLane, eventTime)
  │           │   └─ root.pendingLanes |= TransitionLane
  │           └─ ensureRootIsScheduled(root, eventTime)
  │               └─ 优先级不同，取消旧任务，调度新任务
  └─ ReactCurrentBatchConfig.transition = null
  ↓

4. Scheduler 调度层
事件结束，异步任务触发
  ↓
performWorkUntilDeadline() 执行
  ├─ currentTime = getCurrentTime()
  ├─ deadline = currentTime + 5ms
  └─ scheduledHostCallback(hasTimeRemaining, currentTime)
      ↓
      flushWork(hasTimeRemaining, currentTime)
      ├─ isHostCallbackScheduled = false
      └─ workLoop(hasTimeRemaining, initialTime)
          ├─ currentTask = peek(taskQueue)  // 取出任务
          └─ callback(didTimeout)  // 执行 performConcurrentWorkOnRoot
              ↓

5. React 渲染层
performConcurrentWorkOnRoot(root)
  ├─ getNextLanes(root, ...)
  │   └─ 返回 root.pendingLanes（包含 DefaultLane 和 TransitionLane）
  ├─ renderRootConcurrent(root, lanes)
  │   ├─ prepareFreshStack(root, lanes)
  │   │   └─ workInProgress = createWorkInProgress(root.current, ...)
  │   └─ workLoopConcurrent()
  │       └─ while (workInProgress !== null && !shouldYield())
  │           └─ workInProgress = performUnitOfWork(workInProgress)
  │               ↓

6. 工作单元处理层
performUnitOfWork(unitOfWork)
  ├─ beginWork(current, unitOfWork, renderLanes)
  │   ├─ 根据 unitOfWork.tag 处理不同类型
  │   │   ├─ FunctionComponent → updateFunctionComponent(...)
  │   │   │   ├─ renderWithHooks(...)
  │   │   │   │   ├─ useState → updateState → updateReducer
  │   │   │   │   │   └─ 处理 queue.pending，计算新状态
  │   │   │   │   └─ 执行组件函数，返回 children
  │   │   │   └─ reconcileChildren(current, workInProgress, children, renderLanes)
  │   │   │       └─ 对比新旧 children，标记 effect
  │   │   └─ HostComponent → updateHostComponent(...)
  │   │       └─ reconcileChildren(...)
  │   └─ 返回 next（子节点或 null）
  │
  ├─ unitOfWork.memoizedProps = unitOfWork.pendingProps
  │
  └─ if (next === null)
      └─ next = completeUnitOfWork(unitOfWork)
          ├─ completeWork(current, unitOfWork, renderLanes)
          │   └─ 收集 effect，构建 effectList
          └─ 返回 sibling 或 return（向上回溯）
  ↓

7. 时间片检查
shouldYield()
  ├─ deadline.timeRemaining() > timeHeuristicForUnitOfWork?
  │   ├─ 是 → 返回 false，继续工作
  │   └─ 否 → 检查 isInputPending()
  │       ├─ 有输入 → 返回 true，让出控制权
  │       └─ 无输入 → 返回 true，让出控制权
  │
  └─ 如果让出控制权
      ├─ workInProgress 保存当前节点（状态保存）
      └─ performWorkUntilDeadline 的 finally 块
          └─ schedulePerformWorkUntilDeadline()  // 调度下一个时间片
```

**关键调用路径总结**：

1. **调度路径**：

   ```bash
   setState → dispatchSetState → scheduleUpdateOnFiber
   → ensureRootIsScheduled → scheduleCallback
   → requestHostCallback → performWorkUntilDeadline
   ```

2. **渲染路径**:

   ```bash
   performWorkUntilDeadline → flushWork → workLoop
   → performConcurrentWorkOnRoot → renderRootConcurrent
   → workLoopConcurrent → performUnitOfWork
   ```

3. **工作单元路径**：
   ```bash
   performUnitOfWork → beginWork → updateFunctionComponent
   → renderWithHooks → useState/useEffect → reconcileChildren
   → completeUnitOfWork → completeWork
   ```

**优势**：

- 标签切换立即响应（高优先级 DefaultLane）
- 快速切换时，只加载最后选中的标签（低优先级 TransitionLane 可被打断）
- 不会阻塞用户交互（时间分片机制）

## 总结

React 的并发特性通过以下机制提升用户体验：

1. **时间分片**：将长任务分割，不阻塞主线程
2. **优先级调度**：高优先级任务可以打断低优先级任务
3. **可中断渲染**：支持中断和恢复，提高响应性
4. **API 支持**：`startTransition`、`useDeferredValue`、`Suspense` 等

这些特性让 React 应用能够：
- 保持流畅的用户交互
- 处理大量数据渲染
- 优化加载体验
- 提升整体性能

通过合理使用这些 API，开发者可以构建更流畅、更响应的用户界面。
