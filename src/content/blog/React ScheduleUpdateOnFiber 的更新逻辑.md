---
title: React ScheduleUpdateOnFiber 的调度逻辑
subtitle: 调度机制详解
date: 2025-12-23 12:00:00 +0800
tags: 前端 源码
remark: 'React ScheduleUpdateOnFiber 的更新逻辑，主要介绍事件监听与批处理机制，以及同步任务和异步任务的执行过程'
---

# React ScheduleUpdateOnFiber 的调度逻辑

> ScheduleUpdateOnFiber：当一个组件状态或属性发生变化时，最终都会调用这个函数。
>
> 它的核心作用：接收一个“更新请求”，并根据其优先级和当前渲染模式，决定如何、何时安排一次新的渲染工作。 
>
> 它负责标记需要更新的组件树，并启动 React 的协调与渲染流程，是实现并发渲染等高级特性的基石。

## 事件监听与批处理机制

设想一个场景：鼠标划过 React 应用发生了什么事情？

1. React 注册了全局的合成事件，因此触发了 `dispatchEvent`

2. `dispatchEvent` 触发更新事件，开始执行批处理 `batchedUpdates`

3. `batchedUpdates` 通过全局的状态设置当前是否已经开始了批处理，以及标记批处理结束

   ```ts
   export function batchedUpdates(fn, a) {
     //	保留原始状态，用于执行后恢复现场
     const prevExecutionContext = executionContext;
     //	进入批处理状态
     executionContext |= BatchedContext;
     try {
       return fn(a);	//	执行真正的操作
     } finally {
       //	最后恢复现场
       executionContext = prevExecutionContext;
       //	同步任务处理
       if (
         executionContext === NoContext &&
         !(__DEV__ && ReactCurrentActQueue.isBatchingLegacy)
       ) {
         resetRenderTimer();
         flushSyncCallbacksOnlyInLegacyMode();
       }
     }
   }
   ```

4. 如果此时你在 `pointerHover` 事件上执行了对 React 状态的修改，`setState` -> `dispatchSetState`

5. 通过 `dispatcher` 就进入了 `ScheduleUpdateOnFiber` 执行调度

**结论**：事件触发频率 ≠ 渲染频率。只有实际的状态变更才会进入 React 的更新流程。事件系统与更新系统是解耦的，这是 React 性能的关键设计之一。

## 同步任务

在批处理过程中执行了同步任务，该场景下会经历怎样的代码执行过程？

```js
function handleClick() {
  // 1. 进入批处理上下文
  setCount(1);
  // 2. 触发同步更新
  flushSync(() => {
    setCount(2);
  });
  // 3. 继续批处理
  setCount(3);
}
```

这个表现关系到 React 17 和 React 18 在设计细节上的差异，React 18 使用了更先进的 Lane 优先级模型。

```ts
// 在 react17 中，需要把上下文中的批处理标记去掉
function flushSync(fn) {
  // 1. 清除批处理标志
  const prevExecutionContext = executionContext;
  executionContext &= ~BatchedContext;  // 移除批处理标志
  
  try {
    // 2. 执行回调
    fn();  // 这里的 setState 会立即触发同步更新
    
    // 3. 同步刷新所有待处理的更新
    flushSyncCallbacks();
  } finally {
    // 4. 恢复之前的执行上下文
    executionContext = prevExecutionContext;
  }
}

// 而在 react18 中，直接把 lane 调整为同步优先级
export function flushSync(fn) {
  const prevExecutionContext = executionContext;
  //	这里依旧是添加批处理标记
  executionContext |= BatchedContext;

  const prevTransition = ReactCurrentBatchConfig.transition;
  const previousPriority = getCurrentUpdatePriority();

  try {
    //	设置不过渡
    ReactCurrentBatchConfig.transition = null;
    //	设置同步的优先级
    setCurrentUpdatePriority(DiscreteEventPriority);
    if (fn) {
      return fn();
    } else {
      return undefined;
    }
  } finally {
    //	恢复现场
    setCurrentUpdatePriority(previousPriority);
    ReactCurrentBatchConfig.transition = prevTransition;

    executionContext = prevExecutionContext;
    //	如果当前不处于 render 或者 commit 阶段，即空闲或者批处理时则可以触发回调执行
    if ((executionContext & (RenderContext | CommitContext)) === NoContext) {
      //	执行更新
      flushSyncCallbacks();
    }
  }
}
```

**React 18 的改进**：更细化更新环节，在 `flushSync` 中依赖 lane 优先级，不过度影响上下文信息，支持中断更新的新特性。

最后判断是否处于 render 或 commit 是避免出现以下场景：

```ts
// 场景1：在组件渲染中调用 flushSync
function Component() {
  const [state, setState] = useState(0);
  
  if (condition) {
    flushSync(() => {
      setState(1);  // 当前在 RenderContext
    });
  }
  
  return <div />;
}

// 场景2：在 useLayoutEffect 中调用 flushSync
useLayoutEffect(() => {
  flushSync(() => {
    setState(1);  // 当前在 CommitContext
  });
});
```

正确的使用场景应该在各种无状态的上下文中被使用

```ts
// 场景1：事件处理器
onClick = () => {
  flushSync(() => {
    setState(1);  // 安全：NoContext
  });
};

// 场景2：setTimeout/Promise
setTimeout(() => {
  flushSync(() => {
    setState(1);  // 安全：NoContext
  });
}, 1000);
```

**Context 类型概念**

- `NoContext`：处于空闲阶段
- `BatchedContext`：处于批处理中
- `RenderContext`：处于渲染阶段
- `CommitContext`：处于提交阶段

## Update Queue 更新队列

用户点击触发更新的场景（Hook）：

```
用户点击 → 触发3个setState
    ↓
enqueueConcurrentHookUpdate 标记路径
    ↓
scheduleUpdateOnFiber 被调用3次
    ↓
每次调用：合并lane到root.pendingLanes
    ↓
ensureRootIsScheduled 确保只有一个任务被安排
    ↓
任务执行时：一次性处理所有pendingLanes
    ↓
单次协调循环 + 单次提交 = 一次DOM更新
```

在 React 18 中，所有的状态更新都会得到一个 `update`，最终被 `enqueueConcurrentHookUpdate` 放到某一个 `Fiber` 的 `updateQueue` 之中，并通过 `markUpdateLaneFromFiberToRoot` 递归标记整颗树并返回根。

回到可中断且为批处理的 `enqueueConcurrentHookUpdate` ，有以下特征：

| 维度          | 特点                                 |
| ------------- | ------------------------------------ |
| 是否立即生效  | 否                                   |
| 是否中断      | 可被打断                             |
| 是否批处理    | 批处理                               |
| 使用 `Lane`   | `Transition / Default / Idle`        |
| `UpdateQueue` | `Hook queue（circular linked list）` |
| 调度方式      | `scheduleUpdateOnFiber`              |

这里有个反逻辑的点：**Hooks 即使是"同步事件触发"，在 React18 里，仍然统一走 `concurrent enqueue` 方法**，区别只在 lane 模型上，这也是 Hooks 原生并发的重要设计。

只有在类组件中才是兼容模式，既支持同步的触发 `enqueueUpdate`，也支持异步的触发 `enqueueConcurrentClassUpdate`

```ts
//	class 类上的 enqueueUpdate 方法
export function enqueueUpdate(fiber, update, lane) {
  const updateQueue = fiber.updateQueue;

  if (isUnsafeClassRenderPhaseUpdate(fiber)) {
    const pending = sharedQueue.pending;
    if (pending === null) {
      update.next = update;
    } else {
      update.next = pending.next;
      pending.next = update;
    }
    sharedQueue.pending = update;
    //	同步
    return unsafe_markUpdateLaneFromFiberToRoot(fiber, lane);
  } else {
    //	并行
    return enqueueConcurrentClassUpdate(fiber, sharedQueue, update, lane);
  }
}

//	核心的同步异步判断方法：只能在渲染阶段，不使用异步模式，只能在 class 类组件中
//	只能在 render 时同步处理是极致的性能追求，保证状态的同步，且防止无限循环的紧急处理
export function isUnsafeClassRenderPhaseUpdate(fiber) {
  return (
    (!deferRenderPhaseUpdateToNextBatch || (fiber.mode & ConcurrentMode) === NoMode) &&
    (executionContext & RenderContext) !== NoContext
  );
}

//	以上方法最终都会调用 `markUpdateLaneFromFiberToRoot` 从更新节点向上递归打标签到根节点。
```

在 Hook 中执行了 `enqueueConcurrentHookUpdate` 后，有三个属性被建立或修改：

1. Update 对象，描述这次状态变更的实例，不需要执行、不需要计划，核心是记录更新和记录优先级；
2. Hook 中对应的更新链表，每个 hook 有一个 queue 环形链表，用于批处理；
3. Root 的 `pendingLanes`，描述了这个树下发生了改变，也是下文的状态处理的入口。

而类中执行的更新队列，与 Hook 的差异主要在于：

1. 挂载点不同，类的更新队列挂载在 Fiber 上，一个 Fiber 有一个更新队列；
2. 队列的结构不同，类的更新队列是一个单链的结构；

但本质上这两者在后续的调度中没有太大的差别，意义都描述一次更新。

## scheduleUpdateOnFiber 

先了解这个阶段的职责：**把“某个 Fiber 上发生的更新”，升级为“某个 Root 需要被调度执行的任务”。**

不 render 、不计算 state 、也不遍历树，目标只解决以下三个问题：

1. **把 Fiber 的更新升级为 Root 的更新；**

   这句话只需要一行代码即可解释，`root.pendingLanes |= lane` ，这里只会调度 Root 而不是调度 Fiber ；后续通过深度遍历+递归的方式再处理 Root 这棵树所有要更新的 Fiber。

2. **决定执行时机，现在执行还是等待合适时机执行；**

   | 判断点            | 含义                       |
   | ----------------- | -------------------------- |
   | executionContext  | 当前是不是 render / commit |
   | lane              | 是不是 SyncLane            |
   | root 是否已被调度 | 避免重复调度               |

3. **合并处理，确保 Root 只被调度一次；React 保证同一 Root、同一批次、同一优先级只有一次更新**

   ```js
   //	本质上执行了防抖处理
   if (!rootIsScheduled) {
     ensureRootIsScheduled(root)
   }
   ```

最小化实现一个 `scheduleUpdateOnFiber`

```js
function scheduleUpdateOnFiber(root, fiber, lane) {
  // 标记 root 有活（此外还做了，取消加载状态，记录事件更新时间用于 JND 优化）
  markRootUpdated(root, lane)

  // 判断执行时机
  if (lane === SyncLane && notInConcurrentContext) {
    performSyncWork(root)   // 不展开
  } else {
    ensureRootIsScheduled(root)
  }
}

export function markRootUpdated(root, updateLane, eventTime) {
  root.pendingLanes |= updateLane;
  // ...
  const eventTimes = root.eventTimes;
  const index = laneToIndex(updateLane);
  eventTimes[index] = eventTime;
}
```

## ensureRootIsScheduled

`ensureRootIsScheduled` 是 React 调度系统的任务分配器，负责以下工作：

- 检查任务状态
- 确定执行优先级（执行高优先级打断）
- 确定执行方式（同步/异步）
- 避免重复调度

**避免重复调度的机制有三个：**

1. 事件时间复用，在单次事件中，`currentEventTime` 是共享同一个时间戳的

   ```ts
   export function requestEventTime() {
     if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
       // We're inside React, so it's fine to read the actual time.
       return now();
     }
     // We're not inside React, so we may be in the middle of a browser event.
     if (currentEventTime !== NoTimestamp) {
       // Use the same start time for all updates until we enter React again.
       return currentEventTime;
     }
     // This is the first update since React yielded. Compute a new start time.
     currentEventTime = now();
     return currentEventTime;
   }
   ```

2. Lane 合并机制，在 markRootUpdated 合并所有需要更新的 lane 而不是重新创建

   ```ts
   export function markRootUpdated(root, updateLane, eventTime) {
     root.pendingLanes |= updateLane;
     // ...
   }
   ```

3. 优先级复用检查，如果优先级相同，则直接复用现有任务并返回，而不是重新调度

   ```ts
   const existingCallbackPriority = root.callbackPriority;
   if (
     existingCallbackPriority === newCallbackPriority &&
   ) {
     // The priority hasn't changed. We can reuse the existing task. Exit.
     return;
   }
   ```

后续是如何通过回调执行 render 的

**同步任务**

1. 先把回调放入 `syncQueue` 不立即执行；
2. 通过微任务队列延迟执行 `flushSyncCallbacks` 
3. 微任务在同步代码执行完毕后、下一个事件循环前执行

```ts
// 把回调放入 syncQueue 延迟执行
let newCallbackNode;
if (newCallbackPriority === SyncLane) {
  // Special case: Sync React callbacks are scheduled on a special
  // internal queue
  if (root.tag === LegacyRoot) {
    scheduleLegacySyncCallback(performSyncWorkOnRoot.bind(null, root));
  } else {
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
  }
  if (supportsMicrotasks) {
    scheduleMicrotask(() => {
      if ((executionContext & (RenderContext | CommitContext)) === NoContext) {
        flushSyncCallbacks();
      }
    });
  } else {
    // Flush the queue in an Immediate task.
    scheduleCallback(ImmediateSchedulerPriority, flushSyncCallbacks);
  }
}
```

```ts
//	批处理事件执行完毕后
export function batchedUpdates(fn, a) {
  const prevExecutionContext = executionContext;
  executionContext |= BatchedContext;
  try {
    return fn(a);
  } finally {
    executionContext = prevExecutionContext;
    if (
      executionContext === NoContext
    ) {
      resetRenderTimer();
      flushSyncCallbacksOnlyInLegacyMode();
    }
  }
}
```

执行流程如下：

```jsx
用户点击按钮
  ↓
batchedUpdates 开始（设置 executionContext |= BatchedContext）
  ↓
setState 1
  ├─ scheduleUpdateOnFiber
  ├─ markRootUpdated（合并 lane）
  ├─ ensureRootIsScheduled
  │   ├─ scheduleSyncCallback（放入 syncQueue，不执行）
  │   └─ scheduleMicrotask（调度微任务，但还没执行）
  ↓
setState 3
  ├─ scheduleUpdateOnFiber
  ├─ markRootUpdated（合并 lane）
  ├─ ensureRootIsScheduled
  │   ├─ 优先级相同，复用任务（return）
  │   └─ scheduleSyncCallback（再次放入 syncQueue）
  ↓
batchedUpdates 结束（finally 块）
  ├─ executionContext = NoContext
  ├─ flushSyncCallbacksOnlyInLegacyMode()
  ↓
当前同步代码执行完毕
  ↓
微任务执行（scheduleMicrotask 的回调）
  ├─ 检查 executionContext === NoContext ✅
  └─ flushSyncCallbacks()
      ├─ 遍历 syncQueue
      └─ 执行 performSyncWorkOnRoot（一次性处理所有 3 个更新）
```

**异步任务**

异步更新时，也是统一收集后才触发 render，这里还需要时刻记录一下优先级。

```js
newCallbackNode = scheduleCallback(
  schedulerPriorityLevel,
  performConcurrentWorkOnRoot.bind(null, root),
);
root.callbackPriority = newCallbackPriority;
root.callbackNode = newCallbackNode;
```

* 执行路径：`scheduleCallback → requestHostCallback → performWorkUntilDeadline → flushWork → workLoop → performConcurrentWorkOnRoot`

* 统一消费：`getNextLanes` 从 `root.pendingLanes` 中获取所有已合并的 `lanes`，`renderRootConcurrent` 统一处理

* 等待机制：异步调度确保所有更新先被合并到 `pendingLanes`，再统一执行 `render`

```ts
用户触发事件（如数据加载完成）
  ↓
setState 1
  ├─ markRootUpdated(root, DefaultLane, t1)
  │   └─ root.pendingLanes |= DefaultLane  // 合并到 pendingLanes
  ├─ ensureRootIsScheduled
  │   └─ scheduleCallback(NormalPriority, performConcurrentWorkOnRoot)
  │       ├─ push(taskQueue, task1)  // 任务入队
  │       └─ requestHostCallback(flushWork)  // 触发异步执行
  │           └─ schedulePerformWorkUntilDeadline()  // MessageChannel 异步
  ↓
setState 3（同一事件中）
  ├─ markRootUpdated(root, DefaultLane, t1)
  │   └─ root.pendingLanes |= DefaultLane  // 再次合并
  ├─ ensureRootIsScheduled
  │   └─ 优先级相同，复用任务（return）
  ↓
事件结束，异步任务触发
  ↓
performWorkUntilDeadline 执行
  └─ flushWork(hasTimeRemaining, currentTime)
      └─ workLoop(hasTimeRemaining, initialTime)
          ├─ currentTask = peek(taskQueue)  // 取出 task1
          └─ callback(didTimeout)  // 执行 performConcurrentWorkOnRoot
              ├─ getNextLanes(root, ...)
              │   └─ 返回 root.pendingLanes 中的所有 DefaultLane ✅
              │       （包含 3 个更新的 lanes）
              ├─ renderRootConcurrent(root, lanes)
              │   └─ workLoopConcurrent()
              │       └─ 遍历 Fiber 树，处理所有 lanes 的更新
              │           └─ 一次性处理所有 3 个更新 ✅
              └─ 返回 continuation 或 null
```

## 总结

自此从 dispatcher 到 Fiber update 再到 Root 的完整调度就已经完成，涉及到合成事件、批处理、Lanes 优先级、合并调度、构造 Fiber Update 对象等核心概念。

接下来再重点讲解 reconciler 的全过程。








