---
title: React Scheduler 与优先级模型
subtitle: Lanes 优先级与时间分片
date: 2025-12-28 12:00:00 +0800
tags: 前端 源码
remark: 'React Scheduler 调度器与 Lanes 优先级模型，包括 Sync/Transition/Idle 优先级区别、优先级冲突调度、中断与恢复机制'
---

# React Scheduler 与优先级模型

> React 的 Scheduler 是调度系统的核心，负责管理任务的优先级、时间分片和中断恢复。
>
> **Lanes**（通道）是 React 18 引入的优先级模型，用位掩码表示不同的优先级，支持多个优先级同时存在，比之前的优先级系统更灵活。
>
> 核心思想：高优先级任务可以打断低优先级任务，确保用户交互的流畅性。

## 什么是 Lane（通道）？

Lane 是 React 18 的优先级表示方式，用**位掩码**（bitmask）表示：

```ts
// Lane 定义（位掩码）
const SyncLane = 0b0000000000000000000000000000001;        // 同步优先级
const InputContinuousLane = 0b0000000000000000000000000000100;  // 连续输入
const DefaultLane = 0b0000000000000000000000000010000;     // 默认优先级
const TransitionLane1 = 0b0000000000000000000000001000000;  // Transition 1
const TransitionLane2 = 0b0000000000000000000000010000000;  // Transition 2
const IdleLane = 0b0100000000000000000000000000000;        // 空闲优先级
```

**为什么用位掩码？**

1. **支持多优先级**：可以同时存在多个优先级（`lanes |= lane1 | lane2`）
2. **高效计算**：位运算比数组操作快
3. **灵活组合**：可以合并、分离、比较优先级

```ts
// 合并多个优先级
const lanes = SyncLane | DefaultLane | TransitionLane1;

// 检查是否包含某个优先级
if (lanes & SyncLane) {
  // 包含同步优先级
}

// 移除某个优先级
lanes &= ~SyncLane;
```

## 优先级类型

React 定义了多种优先级，从高到低：

| 优先级 | Lane | 触发场景 | 特点 |
|--------|------|----------|------|
| **Sync** | `SyncLane` | `flushSync`、`useLayoutEffect` | 同步执行，不可中断 |
| **InputContinuous** | `InputContinuousLane` | 连续输入（拖拽、滚动） | 高优先级，需要快速响应 |
| **Default** | `DefaultLane` | 普通事件（点击、输入） | 默认优先级 |
| **Transition** | `TransitionLane*` | `startTransition`、`useTransition` | 可中断，低优先级 |
| **Idle** | `IdleLane` | 空闲时执行 | 最低优先级 |

### Sync 优先级

同步优先级，不可中断，立即执行：

```ts
// 使用场景
flushSync(() => {
  setState(1);  // 同步更新
});

// 在 useLayoutEffect 中
useLayoutEffect(() => {
  setState(1);  // 同步更新，立即触发新的渲染周期
  
  // 注意：useLayoutEffect 中的更新会立即触发同步渲染
  // 1. 会立即进入新的 Render Phase + Commit Phase
  // 2. 阻塞浏览器绘制，直到新的渲染完成
  // 3. useEffect 不会立即执行，仍然在浏览器绘制后的微任务中执行
  // 4. 如果更新导致大量工作，会导致页面卡顿
  // 
  // 正确的使用场景：测量 DOM、同步样式等轻量操作
}, []);
```

**特点**：
- 不经过 Scheduler，直接执行
- 阻塞渲染，直到完成
- 用于需要立即生效的更新

**useLayoutEffect 中的更新行为**：

```tsx
function Component() {
  const [count, setCount] = useState(0);
  
  useLayoutEffect(() => {
    setCount(1);  // 同步更新
    console.log('Layout Effect');
  }, []);
  
  useEffect(() => {
    console.log('Effect');  // 会立即执行！
  }, [count]);
  
  return <div>{count}</div>;
}
```

**执行流程**：

```bash
1. 首次渲染完成
   ├─ Render Phase
   └─ Commit Phase
       ├─ Before Mutation
       │   └─ 调度 useEffect（微任务，还未执行）
       ├─ Mutation（更新 DOM）
       └─ Layout
           └─ useLayoutEffect 执行
               └─ setCount(1) 触发同步更新
                   ↓
                   ⚠️ 检测到在 Commit 过程中有更新
                   ↓
2. React 立即执行完当前 commit 的所有 Effects
   └─ 执行 useEffect（立即执行，不等微任务）
       └─ console.log('Effect')  // 立即输出
           ↓
3. 然后进入新的渲染周期（同步）
   ├─ Render Phase（同步执行）
   └─ Commit Phase（同步执行）
       ├─ Before Mutation
       ├─ Mutation（更新 DOM）
       └─ Layout
           └─ useLayoutEffect 执行
               ↓
4. 浏览器绘制被阻塞
   └─ 等待所有同步渲染完成
       ↓
5. 浏览器绘制
```

**关键点**：
- `useLayoutEffect` 中的更新相当于在 **Commit 过程中插入了一个新的 render 请求**
- React 为了**不留下"半套 Effect"**（部分 Effect 执行了，部分没执行），会**立即执行完当前 commit 的所有 Effects**，包括 `useEffect`
- 然后再进入新的渲染周期
- 这会**阻塞浏览器绘制**，直到所有同步渲染完成
- 如果更新导致大量工作，会导致页面卡顿

**为什么需要立即执行所有 Effects？**

如果 React 不立即执行完所有 Effects，可能会出现：
- `useLayoutEffect` 执行了，但 `useEffect` 还没执行
- 然后进入新的渲染周期，状态已经改变
- 导致 Effect 的执行顺序和时机错乱

React 通过立即执行完所有 Effects，保证 Effect 的完整性和一致性。

### Transition 优先级

Transition 优先级用于**非紧急更新**，可以被高优先级任务打断：

```ts
function App() {
  const [isPending, startTransition] = useTransition();
  const [count, setCount] = useState(0);
  const [list, setList] = useState([]);
  
  function handleClick() {
    setCount(count + 1);  // 高优先级：立即更新 UI
    
    startTransition(() => {
      setList(generateLargeList());  // 低优先级：可以被打断
    });
  }
  
  return (
    <div>
      <button onClick={handleClick}>Click</button>
      {isPending && <Spinner />}
      <div>Count: {count}</div>
      <List items={list} />
    </div>
  );
}
```

**Transition 的优势**：

1. **不阻塞交互**：高优先级更新（如按钮点击）可以立即响应
2. **可中断**：如果用户再次交互，可以中断 Transition 更新
3. **降级处理**：如果 Transition 更新被多次中断，React 会降级为同步更新

### Idle 优先级

Idle 优先级用于**不重要的后台任务**，只在浏览器空闲时执行：

```ts
// 使用场景：数据预加载、分析上报等
scheduleCallback(IdlePriority, () => {
  preloadData();
  sendAnalytics();
});
```

## Scheduler 调度机制

Scheduler 是独立于 React 的调度库，负责管理任务队列和时间分片。它是 React 并发渲染的基础，让 React 能够中断和恢复渲染工作。

### 任务队列

Scheduler 维护两个任务队列，用于管理不同优先级的任务：

**队列类型**：

1. **taskQueue**：立即执行的任务队列
   - 存储所有需要立即执行的任务
   - 按优先级排序，高优先级任务在前
   - 使用最小堆（Min Heap）数据结构，保证高效取最高优先级任务

2. **timerQueue**：延迟执行的任务队列
   - 存储需要延迟执行的任务
   - 任务会在指定时间后才移到 taskQueue
   - 用于实现延迟调度的功能

**任务结构**：

```ts
// 任务队列（按优先级分组）
const taskQueue: Task[] = [];  // 立即执行的任务
const timerQueue: Task[] = [];  // 延迟执行的任务

// 任务结构
interface Task {
  id: number;                    // 任务唯一标识
  callback: () => void;          // 任务回调函数
  priorityLevel: number;         // 优先级级别
  startTime: number;             // 任务开始时间
  expirationTime: number;       // 任务过期时间（用于判断是否超时）
}
```

**任务调度流程**：

1. 新任务加入时，根据优先级和过期时间决定放入哪个队列
2. 高优先级任务会插入到 taskQueue 的前面
3. 延迟任务先放入 timerQueue，到达时间后移到 taskQueue
4. 执行时从 taskQueue 取出最高优先级的任务

### 时间分片

Scheduler 使用**时间分片**（Time Slicing）技术，将长任务分割成多个小任务。每个时间片默认 5ms，在这段时间内执行尽可能多的工作，然后让出控制权给浏览器。

**核心思想**：不让单个任务长时间占用主线程，而是分成多个小片段执行。

**工作循环流程**：

```ts
// 每个时间片的长度（5ms）
const frameInterval = 5;

function workLoop(hasTimeRemaining: boolean, initialTime: number) {
  let currentTime = initialTime;
  currentTask = peek(taskQueue);  // 取出最高优先级的任务
  
  // 循环处理任务，直到时间用完或任务完成
  while (currentTask !== null) {
    // 检查时间片是否用完
    // 条件1：任务未过期 且 条件2：没有剩余时间 或 需要让出控制权
    if (currentTask.expirationTime > currentTime && (!hasTimeRemaining || shouldYieldToHost())) {
      // 时间用完了，让出控制权
      break;
    }
    
    // 执行任务回调
    const callback = currentTask.callback;
    if (callback !== null) {
      currentTask.callback = null;  // 清空回调，避免重复执行
      const didUserCallbackTimeout = currentTask.expirationTime <= currentTime;
      
      // 执行回调，可能返回 continuation 函数（如果任务未完成）
      const continuationCallback = callback(didUserCallbackTimeout);
      
      if (typeof continuationCallback === 'function') {
        // 任务未完成，保存 continuation 函数，下次继续执行
        currentTask.callback = continuationCallback;
      } else {
        // 任务完成，从队列中移除
        pop(taskQueue);
      }
    } else {
      // 回调为空，直接移除
      pop(taskQueue);
    }
    
    // 继续处理下一个任务
    currentTask = peek(taskQueue);
  }
  
  // 返回是否还有工作要做
  if (currentTask !== null) {
    return true;  // 还有工作要做，需要继续调度
  } else {
    return false;  // 工作完成
  }
}
```

**关键机制**：

1. **Continuation 模式**：任务可以返回一个 continuation 函数，表示任务未完成，下次继续执行
2. **时间检查**：每次循环都检查时间是否用完，避免长时间阻塞
3. **优先级保证**：始终处理最高优先级的任务

**时间分片的优势**：

1. **不阻塞主线程**：每次只执行一小段时间（5ms），给浏览器留出处理其他任务的时间
2. **响应交互**：可以及时响应用户输入，不会出现页面卡顿
3. **流畅动画**：不会导致动画掉帧，保证 60fps 的流畅度

### 中断与恢复

Scheduler 的核心能力是支持任务中断和恢复。当时间片用完或有更高优先级的任务时，可以中断当前工作，稍后恢复。

**中断判断：何时让出控制权？**

```ts
function shouldYieldToHost(): boolean {
  const timeElapsed = getCurrentTime() - startTime;
  
  // 1. 如果时间还没用完，继续工作
  if (timeElapsed < frameInterval) {
    return false;  // 还有时间，继续工作
  }
  
  // 2. 时间用完了，检查是否需要让出控制权
  // 让浏览器处理用户输入、动画等
  if (enableIsInputPending) {
    // 2.1 如果需要绘制，立即让出控制权
    if (needsPaint) {
      return true;  // 需要绘制，让出控制权
    }
    
    // 2.2 如果时间还没超过连续输入间隔，检查是否有待处理的输入
    if (timeElapsed < continuousInputInterval) {
      if (isInputPending !== null && isInputPending !== false) {
        return true;  // 有输入，立即让出控制权
      }
    }
  }
  
  // 3. 时间用完，让出控制权
  return timeElapsed > frameInterval;
}
```

**中断判断的关键点**：

1. **时间检查**：如果时间还没用完（< 5ms），继续工作
2. **绘制检查**：如果需要绘制，立即让出控制权，保证视觉更新
3. **输入检查**：如果有用户输入待处理，立即让出控制权，保证交互响应
4. **时间用完**：如果时间用完了，让出控制权

**中断后的恢复：如何继续工作？**

```ts
function performWorkUntilDeadline() {
  if (scheduledHostCallback !== null) {
    const currentTime = getCurrentTime();
    deadline = currentTime + frameInterval;  // 设置新的截止时间（5ms 后）
    
    let hasMoreWork = true;
    try {
      // 执行工作循环（workLoop）
      // 返回 true 表示还有工作，false 表示完成
      hasMoreWork = scheduledHostCallback(true, currentTime);
    } finally {
      if (hasMoreWork) {
        // 还有工作，继续调度下一个时间片
        schedulePerformWorkUntilDeadline();  // 通过 MessageChannel 异步调度
      } else {
        // 工作完成，清理状态
        scheduledHostCallback = null;
        deadline = -1;
      }
    }
  }
}
```

**恢复机制的关键点**：

1. **状态保存**：中断时，`workInProgress` 保存了当前处理的节点，下次从中断处继续
2. **自动续接**：如果还有工作，会自动调度下一个时间片，无需手动触发
3. **异步调度**：使用 MessageChannel 异步调度，不阻塞当前执行栈
4. **完成检测**：当 `hasMoreWork` 为 false 时，表示所有工作完成，清理状态

## 优先级冲突与调度

当多个优先级同时存在时，React 需要决定先处理哪个。这是优先级调度的核心问题。

**场景示例**：
- 用户正在输入（InputContinuousLane）
- 同时有 Transition 更新（TransitionLane）
- 还有 Idle 任务（IdleLane）

React 如何选择？答案是：**总是优先处理最高优先级的任务**。

### 优先级计算

`getNextLanes` 函数负责计算下一个要执行的优先级。它的逻辑是：

1. **优先处理非空闲优先级**：如果有非空闲优先级（Sync、InputContinuous、Default、Transition），优先处理它们
2. **处理被阻塞的优先级**：如果所有非空闲优先级都被阻塞（如 Suspense），检查是否有 pinged 的优先级
3. **最后处理空闲优先级**：只有在没有非空闲优先级时，才处理 Idle 优先级
4. **检查是否需要中断**：如果新任务的优先级更高，需要中断当前工作

```ts
function getNextLanes(
  root: FiberRoot,
  wipLanes: Lanes  // 当前正在工作的优先级
): Lanes {
  const pendingLanes = root.pendingLanes;  // 所有待处理的优先级
  
  if (pendingLanes === NoLanes) {
    return NoLanes;  // 没有待处理的优先级
  }
  
  let nextLanes = NoLanes;
  
  // 1. 优先检查非空闲优先级（Sync、InputContinuous、Default、Transition）
  const nonIdlePendingLanes = pendingLanes & NonIdleLanes;
  if (nonIdlePendingLanes !== NoLanes) {
    // 1.1 检查是否有未被阻塞的非空闲优先级
    const nonIdleUnblockedLanes = nonIdlePendingLanes & ~root.suspendedLanes;
    if (nonIdleUnblockedLanes !== NoLanes) {
      // 有未被阻塞的，选择最高优先级的
      nextLanes = getHighestPriorityLanes(nonIdleUnblockedLanes);
    } else {
      // 1.2 所有非空闲优先级都被阻塞，检查是否有 pinged 的优先级
      // （Suspense 场景：数据加载完成后会 ping）
      const nonIdlePingedLanes = nonIdlePendingLanes & root.pingedLanes;
      if (nonIdlePingedLanes !== NoLanes) {
        nextLanes = getHighestPriorityLanes(nonIdlePingedLanes);
      }
    }
  } else {
    // 2. 只有空闲优先级，处理它们
    const unblockedLanes = pendingLanes & ~root.suspendedLanes;
    if (unblockedLanes !== NoLanes) {
      nextLanes = getHighestPriorityLanes(unblockedLanes);
    }
  }
  
  if (nextLanes === NoLanes) {
    return NoLanes;  // 没有可执行的优先级
  }
  
  // 3. 检查是否需要中断当前工作
  if (
    wipLanes !== NoLanes &&           // 当前有工作在进行
    wipLanes !== nextLanes &&         // 优先级不同
    (wipLanes & nextLanes) === NoLanes  // 没有交集（优先级完全不同）
  ) {
    // 当前工作的优先级低于新任务的优先级
    // 需要中断当前工作，处理更高优先级的任务
    return nextLanes;
  }
  
  return nextLanes;
}
```

**优先级选择的逻辑**：

1. **非空闲优先**：Sync > InputContinuous > Default > Transition > Idle
2. **阻塞处理**：如果优先级被阻塞（如 Suspense），等待 ping 后再处理
3. **中断机制**：如果新任务优先级更高，中断当前工作

### 优先级打断

高优先级任务可以打断低优先级任务。这是 React 并发渲染的核心机制之一。

**打断机制**：当有更高优先级的任务到来时，React 会：
1. 取消当前正在执行的低优先级任务
2. 保存当前工作状态（`workInProgress`）
3. 开始执行高优先级任务
4. 高优先级任务完成后，恢复低优先级任务

```ts
function ensureRootIsScheduled(root: FiberRoot, currentTime: number) {
  const existingCallbackNode = root.callbackNode;  // 当前正在执行的任务
  
  // 1. 标记过期的任务（长时间未执行的任务会被标记为过期）
  markStarvedLanesAsExpired(root, currentTime);
  
  // 2. 获取下一个要执行的优先级
  const nextLanes = getNextLanes(
    root,
    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes
  );
  
  // 3. 计算新的优先级（取最高优先级）
  const newCallbackPriority = getHighestPriorityLane(nextLanes);
  const existingCallbackPriority = root.callbackPriority;
  
  // 4. 如果优先级相同，复用现有任务（避免重复调度）
  if (
    existingCallbackPriority === newCallbackPriority &&
    existingCallbackNode !== null
  ) {
    return;  // 优先级没变，不需要重新调度
  }
  
  // 5. 取消现有任务（如果优先级更高或不同）
  if (existingCallbackNode !== null) {
    cancelCallback(existingCallbackNode);  // 取消当前任务
  }
  
  // 6. 调度新任务
  let newCallbackNode;
  if (newCallbackPriority === SyncLane) {
    // 同步任务：不经过 Scheduler，直接执行
    newCallbackNode = scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
  } else {
    // 异步任务：通过 Scheduler 调度
    const schedulerPriority = lanesToEventPriority(nextLanes);
    newCallbackNode = scheduleCallback(
      schedulerPriority,
      performConcurrentWorkOnRoot.bind(null, root)
    );
  }
  
  // 7. 更新 Root 的任务信息
  root.callbackNode = newCallbackNode;
  root.callbackPriority = newCallbackPriority;
}
```

**打断流程的关键点**：

1. **过期检测**：长时间未执行的任务会被标记为过期，提高优先级
2. **优先级比较**：如果新任务优先级更高，取消当前任务
3. **状态保存**：取消任务时，`workInProgress` 保存了当前状态，可以恢复
4. **同步 vs 异步**：同步任务不经过 Scheduler，异步任务通过 Scheduler 调度

### 优先级跳过

低优先级任务可以被跳过，等待高优先级任务完成。这是 React 优先级调度的另一个重要机制。

**跳过机制**：在渲染过程中，如果某个节点的优先级低于当前渲染的优先级，React 会跳过这个节点，不处理它的更新。

**场景示例**：
- 当前正在渲染 Transition 优先级（低优先级）
- 某个节点的更新是 Transition 优先级
- 用户突然输入（InputContinuous 优先级）
- React 会跳过 Transition 优先级的节点，优先处理输入

```ts
function shouldSkipUpdate(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes  // 当前渲染的优先级
): boolean {
  // 检查当前节点的优先级
  if (current !== null) {
    const oldProps = current.memoizedProps;
    const newProps = workInProgress.pendingProps;
    
    // 如果 Props 没变且 Context 没变，可以尝试跳过
    if (oldProps === newProps && !hasLegacyContextChanged()) {
      // 检查节点的优先级
      const updateLanes = workInProgress.lanes;
      
      // 如果节点的优先级不在本次渲染的优先级中，跳过
      if (!includesSomeLane(renderLanes, updateLanes)) {
        // 当前节点的优先级低于本次渲染的优先级
        // 跳过这个节点，等待下次渲染
        return true;
      }
    }
  }
  
  return false;  // 不跳过，正常处理
}
```

**跳过的关键点**：

1. **优先级检查**：比较节点的优先级和当前渲染的优先级
2. **Props 检查**：如果 Props 没变，可以安全跳过
3. **状态保存**：跳过的节点会保留在 `workInProgress` 中，等待下次处理
4. **性能优化**：跳过低优先级节点，优先处理高优先级任务，提升响应速度

## 实际场景示例

通过实际场景，我们可以更好地理解优先级调度的工作原理。

### 场景 1：用户输入打断渲染

这是最常见的场景：用户在输入时，后台正在渲染大量数据。

```tsx
function App() {
  const [input, setInput] = useState('');
  const [list, setList] = useState([]);
  
  // 高优先级：用户输入
  function handleInput(e) {
    setInput(e.target.value);  // InputContinuousLane（高优先级）
  }
  
  // 低优先级：列表渲染
  useEffect(() => {
    startTransition(() => {
      setList(generateLargeList(input));  // TransitionLane（低优先级）
    });
  }, [input]);
  
  return (
    <div>
      <input value={input} onChange={handleInput} />
      <List items={list} />
    </div>
  );
}
```

**执行流程详解**：

```bash
1. 用户输入 'a'
  ↓
setInput('a') → InputContinuousLane（高优先级）
  ├─ markRootUpdated(root, InputContinuousLane)
  ├─ ensureRootIsScheduled
  └─ scheduleCallback(InputContinuousPriority, ...)
  ↓
2. 开始渲染输入框更新（高优先级）
  ├─ Render Phase
  └─ Commit Phase
      └─ 输入框立即更新 ✅
  ↓
3. 触发 useEffect，开始渲染列表（TransitionLane，低优先级）
  ├─ markRootUpdated(root, TransitionLane)
  ├─ ensureRootIsScheduled
  └─ scheduleCallback(TransitionPriority, ...)
  ↓
4. 开始渲染列表（低优先级，可以被打断）
  ├─ workLoopConcurrent 执行
  └─ 处理列表项...
  ↓
5. 用户继续输入 'b'（高优先级任务到来）
  ↓
setInput('ab') → InputContinuousLane（高优先级）
  ├─ ensureRootIsScheduled
  ├─ 检测到优先级更高
  ├─ cancelCallback(当前 Transition 任务)  // 取消低优先级任务
  └─ scheduleCallback(InputContinuousPriority, ...)  // 调度高优先级任务
  ↓
6. 中断列表渲染，优先处理输入
  ├─ workInProgress 保存当前处理的列表项
  ├─ 立即执行输入框更新
  └─ 输入框立即更新 ✅
  ↓
7. 输入更新完成，继续渲染列表
  ├─ 从 workInProgress 恢复（从上次中断的地方）
  └─ 继续处理列表项...
```

**关键点**：

1. **优先级比较**：InputContinuousLane > TransitionLane，所以输入会打断列表渲染
2. **状态保存**：中断时，`workInProgress` 保存了当前处理的列表项
3. **无缝恢复**：输入更新完成后，列表渲染从中断处继续，用户无感知
4. **用户体验**：输入框始终响应，列表渲染不阻塞交互

### 场景 2：紧急更新打断普通更新

这个场景展示了同步优先级如何打断异步优先级。

```tsx
function App() {
  const [count, setCount] = useState(0);
  const [urgent, setUrgent] = useState(false);
  
  // 普通更新
  function handleClick() {
    setCount(count + 1);  // DefaultLane（异步优先级）
  }
  
  // 紧急更新
  function handleUrgent() {
    flushSync(() => {
      setUrgent(true);  // SyncLane（同步优先级，最高）
    });
  }
  
  return (
    <div>
      <button onClick={handleClick}>Count: {count}</button>
      <button onClick={handleUrgent}>Urgent</button>
      {urgent && <Alert />}
    </div>
  );
}
```

**执行流程详解**：

```bash
1. 点击 Count 按钮
  ↓
setCount(1) → DefaultLane（异步优先级）
  ├─ markRootUpdated(root, DefaultLane)
  ├─ ensureRootIsScheduled
  └─ scheduleCallback(NormalPriority, performConcurrentWorkOnRoot)
      └─ 任务进入 Scheduler 队列
  ↓
2. 开始异步渲染（DefaultLane）
  ├─ performWorkUntilDeadline 执行
  ├─ workLoopConcurrent 开始工作
  └─ 处理 count 更新...
  ↓
3. 用户点击 Urgent 按钮（紧急任务）
  ↓
flushSync(() => { setUrgent(true) })
  ├─ 设置 SyncLane（同步优先级，最高）
  ├─ ensureRootIsScheduled
  ├─ 检测到 SyncLane > DefaultLane
  ├─ cancelCallback(当前 DefaultLane 任务)  // 取消异步任务
  └─ scheduleSyncCallback(performSyncWorkOnRoot)  // 调度同步任务
  ↓
4. 中断当前异步渲染
  ├─ workInProgress 保存当前状态
  └─ 立即开始同步渲染
  ↓
5. 立即执行紧急更新（同步，不可中断）
  ├─ performSyncWorkOnRoot 执行
  ├─ Render Phase（同步）
  └─ Commit Phase（同步）
      └─ Alert 立即显示 ✅
  ↓
6. 紧急更新完成，继续之前的渲染
  ├─ 从 workInProgress 恢复
  └─ 继续处理 count 更新...
```

**关键点**：

1. **优先级差异**：SyncLane（同步）> DefaultLane（异步），同步任务会立即打断异步任务
2. **同步执行**：`flushSync` 中的更新会同步执行，不经过 Scheduler，不可中断
3. **状态保存**：异步任务的状态被保存，同步任务完成后可以恢复
4. **使用场景**：紧急更新（如错误提示）需要立即显示，使用 `flushSync`

## 总结

`Scheduler` 和 `Lanes` 优先级模型是 React 并发渲染的基础：

1. **Lanes 位掩码**：高效表示和操作优先级
2. **多优先级支持**：`Sync、InputContinuous、Default、Transition、Idle`
3. **时间分片**：将长任务分割，不阻塞主线程
4. **中断与恢复**：高优先级任务可以打断低优先级任务
5. **优先级调度**：根据优先级决定执行顺序

这种设计让 React 能够在保持性能的同时，优先响应用户交互，提供流畅的用户体验。

