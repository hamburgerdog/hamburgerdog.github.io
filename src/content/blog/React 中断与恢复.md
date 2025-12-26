---
title: React 中断与恢复
subtitle: 可中断渲染与状态恢复机制
date: 2025-12-28 16:00:00 +0800
tags: 前端 源码
remark: 'React 中断与恢复机制，包括 workInProgress 状态保存、lane 冲突判断、bailout 机制、以及高优先级改变 Fiber 树结构时的处理策略'
---

# React 中断与恢复

> React 的并发渲染支持可中断和可恢复的特性，这是实现时间分片和优先级调度的基础。
>
> 当时间片用完或有更高优先级的任务时，React 会中断当前工作，让出控制权给浏览器。恢复时，React 可以从中断的地方精确继续，不会丢失任何进度。

## 核心机制

React 通过以下方式实现中断与恢复：

1. **循环遍历**：使用循环而非递归遍历 Fiber 树，支持随时中断
2. **状态保存**：通过 `workInProgress` 指针和 Fiber 节点本身保存进度
3. **Lane 冲突判断**：根据 lane 是否冲突决定是恢复 WIP 还是重新构造

## 中断机制

React 使用循环处理工作单元，每次循环检查是否需要中断：

```ts
function workLoopConcurrent() {
  // 循环处理，直到完成或被中断
  while (workInProgress !== null && !shouldYield()) {
    workInProgress = performUnitOfWork(workInProgress);
  }
}

function shouldYield(): boolean {
  if (deadline === null) {
    return false;  // 同步模式，不中断
  }
  
  // 检查是否还有时间片
  return deadline.timeRemaining() <= timeHeuristicForUnitOfWork;
}
```

**中断时机**：
- **时间片用完**：让出控制权给浏览器处理用户输入、动画等
- **高优先级任务插入**：有更高优先级的更新需要立即处理

## 状态保存

中断时，React 的状态保存在两个地方：

### 1. workInProgress 指针

保存在 `FiberRoot` 上，指向当前正在处理的节点：

```ts
interface FiberRoot {
  current: Fiber;              // current 树的根节点
  workInProgress: Fiber | null; // 指向当前正在处理的节点
  workInProgressRootRenderLanes: Lanes;  // 当前 WIP 的 lanes
}
```

### 2. Fiber 节点本身

每个 Fiber 节点保存了自身的状态：

```ts
interface Fiber {
  // 状态数据
  memoizedProps: any;     // 已处理的 props
  memoizedState: any;     // 已处理的状态（Hooks）
  updateQueue: UpdateQueue | null;  // 更新队列
  
  // 副作用标记
  flags: Flags;           // 副作用标记（Placement, Update, Deletion等）
  subtreeFlags: Flags;    // 子树副作用标记
  
  // 树结构
  child: Fiber | null;    // 第一个子节点
  sibling: Fiber | null;  // 下一个兄弟节点
  return: Fiber | null;   // 父节点
  
  // 连接关系
  alternate: Fiber | null;  // 另一个树中对应的节点
}
```

**关键点**：
- 即使节点只处理了一半（如 `beginWork` 完成但 `completeWork` 未完成），状态也保存在节点中
- 恢复时直接从 `workInProgress` 指针和节点中读取状态，无需额外恢复逻辑

## 恢复机制的关键：Lane 冲突判断

**核心问题**：高优先级任务插入时，是恢复旧的 WIP 还是重新构造？

**答案**：取决于 **lane 是否冲突**

```ts
function renderRootConcurrent(root: FiberRoot, lanes: Lanes) {
  // 检查是否需要重新开始
  if (workInProgressRoot !== root || 
      workInProgressRootRenderLanes !== lanes) {
    
    // 关键判断：新 lanes 是否与当前 render lanes 冲突
    if (includesSomeLane(workInProgressRootRenderLanes, lanes)) {
      // Lane 冲突：当前 WIP 作废，必须重新构造
      prepareFreshStack(root, lanes);
    } else {
      // Lane 不冲突：可以暂时挂起，等高优先级完成后恢复
      // workInProgress 保留
    }
  }
  
  // 继续工作循环
  workLoopConcurrent();
}
```

**lane 冲突的含义**：
- 新的更新会影响当前正在 render 的 lanes
- 或更新的 Fiber 在当前 WIP 路径中

## 三种恢复场景

### 场景 1：时间片中断（相同 lanes）

**中断原因**：时间片用完，让出控制权给浏览器

**关键点**：没有新的更新插入，`workInProgress` 保留

```bash
时间线：
1. 任务正在渲染
   ├─ root.workInProgress = div
   ├─ root.workInProgressRootRenderLanes = TransitionLane
   ├─ App 已处理完成 ✅
   ├─ div 部分处理 ✅
   └─ span 未处理 ❌
  ↓
2. 时间片用完，中断
   ├─ workInProgress 指针保留 ✅
   └─ 让出控制权给浏览器
  ↓
3. 恢复时（相同 lanes）
   ├─ workInProgress 仍然有效 ✅
   └─ 从 workInProgress 继续处理
```

**处理方式**：
- **已处理的节点**：通过 bailout 机制跳过，复用已保存的状态
- **未处理的节点**：正常处理
- **部分处理的节点**：继续完成未完成的工作

### 场景 2：Lane 不冲突（可恢复）

**中断原因**：高优先级任务插入，但不影响当前 render lanes

**关键点**：高优先级更新不命中当前 render lanes，WIP 可以保留

```bash
时间线：
1. 低优先级任务正在渲染
   ├─ root.workInProgress = div
   ├─ root.workInProgressRootRenderLanes = TransitionLane
   ├─ 正在处理 ComponentA
   └─ current 树：<App><ComponentA /><ComponentB /></App>
  ↓
2. 高优先级任务插入（用户输入）
   ├─ 新增 update：InputContinuousLane 在 ComponentB
   ├─ 检查：!includesSomeLane(TransitionLane, InputContinuousLane) ✅
   ├─ Lane 不冲突！
   ├─ 暂停当前 render，workInProgress 保留 ✅
   └─ 切换到高优先级 lanes
  ↓
3. 高优先级任务完成
   ├─ renderRootConcurrent(root, InputContinuousLane)
   ├─ 只处理 ComponentB
   └─ commit 到 DOM
  ↓
4. 恢复低优先级任务
   ├─ 从保留的 workInProgress 继续 ✅
   ├─ 继续处理 ComponentA
   └─ 不需要重新构造 WIP
```

**处理方式**：
- **WIP 保留**：当前 `workInProgress` 指针和已构造的 Fiber 节点保留
- **暂停恢复**：高优先级任务完成后，从中断点继续
- **性能优化**：避免重新构造整棵树，这是 React 18 并发渲染的核心优势

**典型例子**：
- 正在 render Transition 更新（TransitionLane）
- 中途来了一个用户输入（InputContinuousLane）
- 且输入更新的组件不在当前 WIP 已处理路径中

### 场景 3：Lane 冲突（必须重来）

**中断原因**：高优先级任务插入，且命中了当前 render lanes

**关键点**：高优先级更新会影响当前 WIP 的状态，必须重新构造

```bash
时间线：
1. 低优先级任务正在渲染
   ├─ root.workInProgress = div
   ├─ root.workInProgressRootRenderLanes = TransitionLane
   ├─ 正在处理 ComponentA
   └─ current 树：<App><div>A</div></App>
  ↓
2. 高优先级任务插入（用户点击）
   ├─ 新增 update：SyncLane 在 ComponentA
   ├─ 检查：includesSomeLane(TransitionLane, SyncLane) ✅
   ├─ Lane 冲突！
   ├─ 当前 WIP 作废 ❌
   └─ prepareFreshStack(root, SyncLane)
  ↓
3. 高优先级任务完成
   ├─ 从 root 重新构造 WIP
   ├─ 处理 SyncLane 更新
   └─ current 树更新：<App><div>C</div><span>New</span></App>
  ↓
4. 低优先级任务恢复
   ├─ 调用 renderRootConcurrent(root, TransitionLane)
   ├─ 检查：lane 冲突已解决
   ├─ prepareFreshStack(root, TransitionLane)
   │   └─ 从最新的 current 树重新创建 WIP
   └─ 所有节点都需要重新处理 ❌
```

**处理方式**：
- **完全重新构造**：从最新的 `current` 树重新创建 `workInProgress`
- **所有节点重新处理**：即使之前已处理过，也需要重新处理
- **基于最新状态**：必须基于高优先级更新后的 `current` 树，应用低优先级的更新

```ts
function prepareFreshStack(root: FiberRoot, lanes: Lanes) {
  // 丢弃旧的 workInProgress
  root.workInProgressRoot = null;
  root.workInProgress = null;
  
  // 从最新的 current 树重新创建 workInProgress
  root.workInProgressRoot = root;
  root.workInProgressRootRenderLanes = lanes;
  root.workInProgress = createWorkInProgress(root.current, null);
}
```

**为什么 lane 冲突时必须重新构造？**

**核心原因：数据一致性**

WIP 是在"特定 lanes 视角下的快照"。一旦新 update 属于当前 lanes 或会改变已 reconcile 过的 Fiber，那么已经构造的 WIP Fiber 的 `memoizedState`、`updateQueue`、`child/sibling` 都可能基于错误前提，只能整体作废。

**举例说明**：

```tsx
// ComponentA 正在 render TransitionLane
function ComponentA() {
  const [count, setCount] = useState(0);  // 当前值：0
  
  // 假设 WIP 已经处理到这里，memoizedState.count = 0
  return <div>{count}</div>;
}

// 此时突然来了一个 SyncLane 更新：setCount(5)
// 如果继续用旧的 WIP：
// - WIP.memoizedState.count = 0 (错误！应该是 5)
// - child Fiber 的 props 是基于 count = 0 构造的 (错误！)

// 必须重新构造 WIP：
// - 从 current 树重新开始
// - 应用 SyncLane 更新：count = 5
// - 重新构造 child Fiber，props 基于 count = 5
```

## Lane 冲突的典型场景

以下是所有会导致 lane 冲突、必须重新构造 WIP 的场景：

### 1. 同一组件的连续更新

**最常见的场景**：同一个组件在不同优先级下连续 setState

```tsx
function Counter() {
  const [count, setCount] = useState(0);
  
  const handleClick = () => {
    // 低优先级更新（Transition）
    startTransition(() => {
      setCount(c => c + 1);  // TransitionLane
    });
    
    // 立即执行一个高优先级更新
    setTimeout(() => {
      setCount(c => c + 10);  // 默认 Lane（更高优先级）
    }, 50);
  };
  
  return <div onClick={handleClick}>{count}</div>;
}
```

**冲突原因**：
- TransitionLane 更新正在渲染，WIP 已经计算了 `count + 1`
- 高优先级更新插入，需要立即应用 `count + 10`
- 两个更新都影响同一个 Fiber 的 `memoizedState.count`
- `includesSomeLane(TransitionLane, DefaultLane)` 返回 true
- **必须重新构造 WIP**，基于最新的 count 值

### 2. 父子组件的优先级交叉

**场景**：父组件低优先级更新进行中，子组件高优先级更新

```tsx
function Parent() {
  const [data, setData] = useState({ value: 0 });
  
  const updateData = () => {
    startTransition(() => {
      setData({ value: 1 });  // TransitionLane
    });
  };
  
  return (
    <div>
      <Child data={data} />
    </div>
  );
}

function Child({ data }) {
  const [local, setLocal] = useState(0);
  
  // 用户交互触发高优先级更新
  const handleClick = () => {
    setLocal(1);  // InputContinuousLane 或 DefaultLane
  };
  
  return <div onClick={handleClick}>{data.value} - {local}</div>;
}
```

**冲突原因**：
- Parent 的 TransitionLane 更新正在渲染，WIP 已经处理了 Parent
- Child 的高优先级更新插入
- 虽然更新的是不同组件，但 Child 在 Parent 的子树中
- 如果 Parent 的 WIP 已经生成了 Child 的 Fiber，其 props 是旧的 `data`
- 高优先级更新完成后，Parent 的 TransitionLane 恢复时必须基于新的 `data`
- **必须重新构造 WIP**

### 3. Context 变化影响多个组件

**场景**：Context 更新影响正在渲染的组件树

```tsx
const ThemeContext = createContext('light');

function App() {
  const [theme, setTheme] = useState('light');
  
  const toggleTheme = () => {
    startTransition(() => {
      setTheme('dark');  // TransitionLane
    });
  };
  
  return (
    <ThemeContext.Provider value={theme}>
      <ComponentA />
      <ComponentB />  {/* 正在渲染这里 */}
      <ComponentC />
    </ThemeContext.Provider>
  );
}

function ComponentB() {
  const theme = useContext(ThemeContext);
  const [count, setCount] = useState(0);
  
  // 用户点击触发高优先级更新
  const handleClick = () => {
    setCount(c => c + 1);  // SyncLane
  };
  
  return <div onClick={handleClick}>{theme} - {count}</div>;
}
```

**冲突原因**：
- TransitionLane 更新正在渲染，WIP 中 ComponentB 的 Context 值是 'light'
- ComponentB 的 SyncLane 更新插入
- SyncLane 完成后，theme 变成 'dark'
- TransitionLane 恢复时，ComponentB 的 Context 值已经变了
- **必须重新构造 WIP**，使用新的 Context 值

### 4. useEffect/useLayoutEffect 触发的更新

**场景**：副作用触发的更新影响正在渲染的树

```tsx
function Parent() {
  const [data, setData] = useState([]);
  
  const loadData = () => {
    startTransition(() => {
      setData([1, 2, 3]);  // TransitionLane
    });
  };
  
  return <Child data={data} onLoad={loadData} />;
}

function Child({ data, onLoad }) {
  const [status, setStatus] = useState('idle');
  
  useEffect(() => {
    if (data.length > 0) {
      // 高优先级更新
      setStatus('loaded');  // PassiveLane → 升级为 DefaultLane
    }
  }, [data]);
  
  return <div>{status}: {data.length}</div>;
}
```

**冲突原因**：
- TransitionLane 更新正在渲染，WIP 中 data.length = 3
- useEffect 在 commit 阶段触发 `setStatus('loaded')`
- 这个更新影响 Child Fiber 的 `memoizedState.status`
- TransitionLane 恢复时，status 已经变了
- **必须重新构造 WIP**

### 5. Suspense 边界的状态变化

**场景**：Suspense 从 pending 到 resolved 的过程中

```tsx
function App() {
  const [query, setQuery] = useState('');
  
  const handleSearch = (value) => {
    startTransition(() => {
      setQuery(value);  // TransitionLane
    });
  };
  
  return (
    <Suspense fallback={<Spinner />}>
      <SearchResults query={query} />
    </Suspense>
  );
}

function SearchResults({ query }) {
  const data = use(fetchData(query));  // 可能 suspend
  return <div>{data}</div>;
}
```

**冲突原因**：
- TransitionLane 更新正在渲染，SearchResults suspend
- WIP 标记 Suspense 边界为 pending 状态
- 数据加载完成，触发高优先级的 retry
- Suspense 状态从 pending 变为 resolved
- 影响 Suspense Fiber 的 `memoizedState`
- **必须重新构造 WIP**

### 6. 同步更新打断并发更新

**场景**：`ReactDOM.flushSync` 强制同步更新

```tsx
function App() {
  const [list, setList] = useState([1, 2, 3]);
  
  const updateList = () => {
    startTransition(() => {
      setList([...list, 4, 5, 6]);  // TransitionLane
    });
  };
  
  const forceSync = () => {
    ReactDOM.flushSync(() => {
      setList([10]);  // SyncLane
    });
  };
  
  return (
    <div>
      <button onClick={updateList}>Update</button>
      <button onClick={forceSync}>Force Sync</button>
      {list.map(i => <Item key={i} value={i} />)}
    </div>
  );
}
```

**冲突原因**：
- TransitionLane 更新正在渲染，WIP 已经生成了一些 Item Fiber
- `flushSync` 触发 SyncLane 更新
- SyncLane 必须立即完成，不能等待 TransitionLane
- 两个更新都影响 list，生成的 Item Fiber 完全不同
- **必须重新构造 WIP**

### 7. 事件优先级提升

**场景**：离散事件（click）打断连续事件（scroll）

```tsx
function App() {
  const [scrollY, setScrollY] = useState(0);
  const [clickCount, setClickCount] = useState(0);
  
  const handleScroll = (e) => {
    // 连续事件，较低优先级
    setScrollY(e.target.scrollTop);  // InputContinuousLane
  };
  
  const handleClick = () => {
    // 离散事件，较高优先级
    setClickCount(c => c + 1);  // SyncLane 或 InputDiscreteLane
  };
  
  return (
    <div onScroll={handleScroll} onClick={handleClick}>
      <div>Scroll: {scrollY}</div>
      <div>Clicks: {clickCount}</div>
    </div>
  );
}
```

**冲突原因**：
- InputContinuousLane 更新正在渲染（scroll）
- 用户点击触发 InputDiscreteLane 更新
- 虽然更新不同的状态，但在同一个组件中
- InputDiscreteLane 优先级更高，必须立即完成
- **必须重新构造 WIP**

### 判断 Lane 冲突的核心条件

React 判断 lane 冲突的核心逻辑：

```ts
function checkLaneConflict(
  currentRenderLanes: Lanes,
  newUpdateLanes: Lanes
): boolean {
  // 1. 新 update 的 lanes 是否与当前 render lanes 有交集
  if (includesSomeLane(currentRenderLanes, newUpdateLanes)) {
    return true;  // 冲突
  }
  
  // 2. 新 update 影响的 Fiber 是否在当前 WIP 路径中
  if (isAncestorOf(newUpdateFiber, workInProgress)) {
    return true;  // 冲突
  }
  
  // 3. 新 update 影响的 Context 是否被当前 WIP 使用
  if (hasContextChanged(newUpdate, workInProgress)) {
    return true;  // 冲突
  }
  
  return false;  // 不冲突
}
```

**总结**：

只要满足以下任一条件，就会发生 lane 冲突，必须重新构造 WIP：

1. **状态冲突**：新 update 影响当前 WIP 已处理的 Fiber 的 state
2. **Props 冲突**：新 update 改变当前 WIP 已处理的 Fiber 的 props
3. **Context 冲突**：新 update 改变当前 WIP 依赖的 Context 值
4. **树结构冲突**：新 update 影响当前 WIP 的树结构（增删节点）
5. **优先级强制**：SyncLane 或 flushSync 强制同步更新

## UpdateQueue 与 BaseQueue 的妙用

在中断与恢复过程中，React 通过 `updateQueue`、`baseQueue` 和 `baseState` 来保证状态的一致性和正确性。这是 React 能够跳过低优先级更新、处理优先级交叉的关键机制。

### UpdateQueue 的结构

每个 Fiber 节点维护一个更新队列：

```ts
interface UpdateQueue<State> {
  // 基准状态：上次渲染确定的状态
  baseState: State;
  
  // 第一个 update（pending 队列的头）
  firstBaseUpdate: Update<State> | null;
  lastBaseUpdate: Update<State> | null;
  
  // 待处理的 update（新产生的 update）
  shared: {
    pending: Update<State> | null;  // 环形链表
  };
}

interface Update<State> {
  lane: Lane;                    // 更新的优先级
  action: State | ((s: State) => State);  // 更新函数
  next: Update<State> | null;    // 下一个 update
}
```

**关键概念**：

1. **baseState**：上次渲染确定的基准状态
2. **baseQueue**：被跳过的低优先级更新队列
3. **pending**：新产生的待处理更新

### 场景：跳过低优先级更新

**问题**：如何在处理高优先级更新时，暂时跳过低优先级更新，但不丢失它们？

**示例**：

```tsx
function Counter() {
  const [count, setCount] = useState(0);
  
  const handleClick = () => {
    // Update 1: 低优先级
    startTransition(() => {
      setCount(c => c + 1);  // TransitionLane, action: c => c + 1
    });
    
    // Update 2: 低优先级
    startTransition(() => {
      setCount(c => c * 2);  // TransitionLane, action: c => c * 2
    });
    
    // Update 3: 高优先级
    setCount(c => c + 10);  // DefaultLane, action: c => c + 10
  };
  
  return <div>{count}</div>;
}
```

**时间线**：

```bash
初始状态：
  count = 0
  updateQueue = {
    baseState: 0,
    baseQueue: null,
    shared.pending: null
  }

点击后，产生 3 个 update：
  updateQueue = {
    baseState: 0,
    baseQueue: null,
    shared.pending: Update3 -> Update1 -> Update2 -> Update3 (环形)
  }
  
  Update1: { lane: TransitionLane, action: c => c + 1 }
  Update2: { lane: TransitionLane, action: c => c * 2 }
  Update3: { lane: DefaultLane, action: c => c + 10 }
```

### 第一次渲染：处理高优先级（DefaultLane）

React 处理 DefaultLane 更新，跳过 TransitionLane 更新：

```ts
function processUpdateQueue(workInProgress, renderLanes) {
  const queue = workInProgress.updateQueue;
  
  // 1. 合并 pending 到 baseQueue
  let firstUpdate = queue.firstBaseUpdate;
  let lastUpdate = queue.lastBaseUpdate;
  let pendingQueue = queue.shared.pending;
  
  if (pendingQueue !== null) {
    // 拆开环形链表，合并到 baseQueue
    // firstUpdate -> Update1 -> Update2 -> Update3
  }
  
  // 2. 遍历 update 队列，跳过低优先级
  let newState = queue.baseState;  // 0
  let newBaseState = newState;
  let newBaseUpdate = null;
  let update = firstUpdate;
  
  while (update !== null) {
    const updateLane = update.lane;
    
    if (!isSubsetOfLanes(renderLanes, updateLane)) {
      // 优先级不够，跳过这个 update
      
      // 关键：保存到 baseQueue
      if (newBaseUpdate === null) {
        // 第一个被跳过的 update
        newBaseUpdate = update;
        // 保存当前状态作为 baseState
        newBaseState = newState;  // 0
      }
      
      // Update1 被跳过
      // newBaseState = 0
      // newBaseUpdate = Update1
    } else {
      // 优先级足够，应用这个 update
      
      // 关键：如果之前有跳过的 update，当前 update 也要保存到 baseQueue
      if (newBaseUpdate !== null) {
        // 克隆当前 update，但 lane 设为 NoLane（表示已处理）
        const clone = {
          lane: NoLane,
          action: update.action,
          next: null
        };
        // 追加到 baseQueue
      }
      
      // 应用 update
      newState = update.action(newState);
      // Update3: newState = 0 + 10 = 10 ✅
    }
    
    update = update.next;
  }
  
  // 3. 保存结果
  workInProgress.memoizedState = newState;  // 10
  workInProgress.updateQueue.baseState = newBaseState;  // 0 (关键！)
  workInProgress.updateQueue.firstBaseUpdate = newBaseUpdate;  // Update1
}
```

**第一次渲染后的状态**：

```bash
视觉结果：count = 10 ✅

Fiber 状态：
  memoizedState: 10          // 当前显示的状态
  updateQueue: {
    baseState: 0,            // 基准状态（被跳过的 update 的起点）
    baseQueue: Update1 -> Update2 -> Update3'  // 需要重新处理的 queue
  }
  
  Update1: { lane: TransitionLane, action: c => c + 1 }  // 被跳过
  Update2: { lane: TransitionLane, action: c => c * 2 }  // 被跳过
  Update3': { lane: NoLane, action: c => c + 10 }        // 已处理，但保留在 baseQueue
```

**关键点**：

1. **baseState = 0**：保存第一个被跳过的 update 之前的状态
2. **baseQueue 保留所有 update**：包括被跳过的和已处理的
3. **Update3' 被克隆**：虽然已经应用，但因为之前有被跳过的 update，所以也保留在 baseQueue

### 第二次渲染：处理低优先级（TransitionLane）

当 TransitionLane 恢复时，React 从 baseState 重新应用 baseQueue：

```ts
function processUpdateQueue(workInProgress, renderLanes) {
  const queue = workInProgress.updateQueue;
  
  // 1. 从 baseState 开始
  let newState = queue.baseState;  // 0 (关键！从基准状态开始)
  
  // 2. 遍历 baseQueue，这次处理 TransitionLane
  let update = queue.firstBaseUpdate;  // Update1
  
  while (update !== null) {
    const updateLane = update.lane;
    
    if (!isSubsetOfLanes(renderLanes, updateLane)) {
      // 优先级不够，跳过（但这次不会跳过任何 update）
    } else {
      // 应用 update
      newState = update.action(newState);
    }
    
    update = update.next;
  }
  
  // 应用顺序：
  // Update1: newState = 0 + 1 = 1    ✅
  // Update2: newState = 1 * 2 = 2    ✅
  // Update3': newState = 2 + 10 = 12 ✅ (重新应用)
  
  // 3. 保存结果
  workInProgress.memoizedState = newState;  // 12
  workInProgress.updateQueue.baseState = newState;  // 12
  workInProgress.updateQueue.firstBaseUpdate = null;  // 清空 baseQueue
}
```

**第二次渲染后的状态**：

```bash
视觉结果：count = 12 ✅

Fiber 状态：
  memoizedState: 12          // 最终状态
  updateQueue: {
    baseState: 12,           // 所有 update 都已处理
    baseQueue: null          // baseQueue 清空
  }
```

**关键点**：

1. **从 baseState 重新开始**：baseState = 0，保证所有 update 按正确顺序应用
2. **Update3' 被重新应用**：虽然之前应用过，但这次是在新的状态（2）上应用，结果不同
3. **保证顺序正确**：0 -> +1 -> *2 -> +10 = 12 ✅

### 为什么需要 BaseQueue？

**问题**：为什么不能只保存被跳过的 update？

**答案**：因为 update 之间可能有依赖关系。

**反例**：如果只保存被跳过的 update：

```bash
错误的处理方式：
第一次渲染（DefaultLane）：
  应用 Update3: 0 + 10 = 10 ✅
  保存被跳过的：Update1, Update2

第二次渲染（TransitionLane）：
  从 memoizedState = 10 开始（❌ 错误！）
  应用 Update1: 10 + 1 = 11
  应用 Update2: 11 * 2 = 22
  
  最终结果：22 ❌ 错误！
  
正确结果应该是：
  0 -> +1 -> *2 -> +10 = 12 ✅
```

**正确的处理方式**：

1. 保存 baseState = 0（第一个被跳过的 update 之前的状态）
2. 保存整个 baseQueue（包括被跳过的和已处理的）
3. 恢复时从 baseState 重新应用所有 update

### BaseQueue 与中断恢复的配合

**场景 1：Lane 不冲突（WIP 保留）**

```bash
1. 正在处理 TransitionLane
   ├─ ComponentA: memoizedState = 1, baseQueue = null ✅
   ├─ ComponentB: 正在处理，baseQueue = null
   └─ ComponentC: 未处理

2. DefaultLane 插入（不冲突）
   ├─ 暂停 TransitionLane
   ├─ WIP 保留 ✅
   └─ 处理 DefaultLane（只影响 ComponentD）

3. 恢复 TransitionLane
   ├─ ComponentA: 已处理，bailout ✅
   ├─ ComponentB: 继续处理
   └─ ComponentC: 开始处理
   
关键：baseQueue 保持不变，WIP 状态保留
```

**场景 2：Lane 冲突（WIP 重建）**

```bash
1. 正在处理 TransitionLane
   ├─ ComponentA: 
   │   updateQueue = {
   │     baseState: 0,
   │     baseQueue: Update1(TransitionLane)
   │   }
   └─ 正在处理...

2. DefaultLane 插入（冲突！）
   ├─ 中断 TransitionLane
   ├─ WIP 作废 ❌
   └─ 处理 DefaultLane:
       └─ ComponentA:
           processUpdateQueue(DefaultLane):
           ├─ 跳过 Update1（TransitionLane）
           ├─ 应用 Update2（DefaultLane）
           └─ baseQueue = Update1 -> Update2' ✅

3. 恢复 TransitionLane（重建 WIP）
   └─ ComponentA:
       processUpdateQueue(TransitionLane):
       ├─ 从 baseState 重新开始 ✅
       ├─ 应用 Update1（TransitionLane）
       ├─ 应用 Update2'（NoLane，重新应用）
       └─ baseQueue = null（所有 update 已处理）

关键：baseQueue 保证了 update 顺序和一致性
```

### BaseQueue 的核心设计

**三个关键点**：

1. **baseState**：第一个被跳过的 update 之前的状态，作为重新计算的起点
2. **baseQueue**：保存所有需要重新处理的 update（包括被跳过的和已处理的）
3. **重新应用**：恢复时从 baseState 开始，重新应用 baseQueue 中的所有 update

**保证的正确性**：

```typescript
// 伪代码表示
function calculateState(updates, renderLanes) {
  let state = baseState;
  for (const update of baseQueue) {
    if (shouldProcess(update.lane, renderLanes)) {
      state = update.action(state);
    }
  }
  return state;
}

// 无论如何中断和恢复，最终结果一致：
// calculateState(allUpdates, AllLanes) 
// === 
// calculateState(highPriorityUpdates, HighLanes) 
//     + calculateState(allUpdates, AllLanes)
```

**总结**：

BaseQueue 机制是 React 并发渲染的核心基础设施：

1. **保证一致性**：无论如何中断和恢复，最终状态一致
2. **支持跳过**：可以暂时跳过低优先级更新，但不丢失它们
3. **正确的依赖**：保证 update 之间的依赖关系正确
4. **高效恢复**：恢复时只需重新应用 baseQueue，不需要重新生成 update

这是 React 能够实现可中断、可恢复的并发渲染的关键机制之一。

## 对比总结

| 中断原因 | Lane 关系 | WIP 是否保留 | 恢复方式 | 性能影响 |
|---------|---------|------------|---------|---------|
| **时间片用完** | 相同 lanes | ✅ 保留 | 从 WIP 继续，已处理节点 bailout | 高效，无需重新处理 |
| **高优先级插入** | Lane 不冲突 | ✅ 保留 | 暂停后从中断点恢复 | 高效，React 18 核心优势 |
| **高优先级插入** | Lane 冲突 | ❌ 被替换 | 重新构造 WIP，baseQueue 保证一致性 | 有开销，但保证一致性 |

## Bailout 机制

当恢复时（WIP 保留的场景），React 通过 bailout 机制跳过已处理的节点：

```ts
function beginWork(current: Fiber | null, workInProgress: Fiber, renderLanes: Lanes) {
  if (current !== null) {
    const oldProps = current.memoizedProps;
    const newProps = workInProgress.pendingProps;
    
    // 检查是否可以复用（bailout）
    if (
      oldProps === newProps &&
      !hasLegacyContextChanged() &&
      !includesSomeLane(renderLanes, workInProgress.lanes)
    ) {
      // 可以复用，跳过处理
      return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
    }
  }
  
  // 不能复用，重新处理
  return updateFunctionComponent(current, workInProgress, Component, newProps, renderLanes);
}
```

**关键点**：
- Props 没变
- Context 没变
- 当前 lanes 不需要更新这个节点

满足条件时，直接复用已保存的状态，跳过处理。

## 总结

React 的中断与恢复机制的核心是 **lane 冲突判断** 和 **BaseQueue 状态管理**：

### 三种中断场景

1. **时间片中断**（相同 lanes）：WIP 保留，从中断点继续
2. **Lane 不冲突**：WIP 保留，暂停后恢复，这是 React 18 并发渲染的核心性能优势
3. **Lane 冲突**：WIP 作废，必须重新构造，通过 BaseQueue 保证数据一致性

### 核心机制

**1. 状态保存**
- `workInProgress` 指针：保存当前处理位置
- Fiber 节点：保存自身状态（memoizedState、flags、树结构等）

**2. BaseQueue 机制**
- `baseState`：第一个被跳过的 update 之前的状态
- `baseQueue`：保存所有需要重新处理的 update（包括被跳过的和已处理的）
- 恢复时从 baseState 重新应用 baseQueue，保证 update 顺序正确

**3. 精确恢复**
- Lane 不冲突：从 workInProgress 继续，已处理节点 bailout
- Lane 冲突：重新构造 WIP，但通过 baseQueue 保证状态一致性

**4. 一致性保证**
- Lane 冲突判断：决定是恢复还是重建
- BaseQueue 重放：保证无论如何中断，最终状态一致
- Update 依赖：通过保留所有 update，保证依赖关系正确

整个过程支持时间分片和优先级调度，是实现并发渲染的基础。BaseQueue 机制确保了在复杂的优先级交叉场景下，状态始终保持一致和正确。
