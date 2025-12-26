---
title: React Render Phase 与 Commit Phase
subtitle: 可中断渲染与不可中断提交
date: 2025-12-29 08:00:00 +0800
tags: 前端 源码
remark: 'React Render Phase 与 Commit Phase 的区别，包括可中断渲染、副作用收集、DOM 更新、生命周期执行等核心机制'
---

# React Render Phase 与 Commit Phase

> React 的更新分为两个阶段：Render Phase（渲染阶段）和 Commit Phase（提交阶段）。
>
> **Render Phase**：可中断、可恢复，在内存中构建新的 Fiber 树，收集副作用，但不影响真实 DOM。
>
> **Commit Phase**：不可中断，一次性应用所有更新到 DOM，执行生命周期函数，保证用户看到的是完整、一致的界面。

## 两阶段的核心区别

| 维度 | Render Phase | Commit Phase |
|------|-------------|--------------|
| **可中断性** | ✅ 可中断、可恢复 | ❌ 不可中断 |
| **DOM 操作** | ❌ 不操作 DOM | ✅ 操作 DOM |
| **副作用** | 收集副作用（标记） | 执行副作用（应用） |
| **优先级** | 支持优先级调度 | 按顺序执行 |
| **时间分片** | ✅ 支持时间分片 | ❌ 一次性完成 |
| **用户可见** | 不可见（内存中） | 可见（DOM 更新） |

## Render Phase：可中断的渲染

Render Phase 的目标：**在内存中构建新的 Fiber 树，找出需要更新的节点，但不修改 DOM**。

### 阶段职责

1. **遍历 Fiber 树**：通过 `beginWork` 和 `completeUnitOfWork` 遍历
2. **对比新旧节点**：找出需要创建/更新/删除的节点
3. **标记副作用**：Placement、Update、Deletion 等
4. **收集 EffectList**：把副作用链成链表，供 Commit 阶段使用
5. **支持中断**：可以随时暂停，让出控制权给更高优先级的任务

### 代码流程

Render Phase 的执行流程分为三个步骤：准备、工作循环、完成检查。

**第一步：准备渲染**

`renderRootConcurrent` 是 Render Phase 的入口函数，负责启动并发渲染：

```ts
function renderRootConcurrent(root: FiberRoot, lanes: Lanes) {
  // 1. 准备渲染：创建 workInProgress 树，初始化状态
  prepareFreshStack(root, lanes);
  // 这一步会：
  // - 创建 workInProgress Fiber 树（从 current 树复制）
  // - 重置 workInProgress 指针，指向根节点
  // - 初始化渲染相关的全局变量
  
  // 2. 开始工作循环：处理 Fiber 节点
  do {
    try {
      workLoopConcurrent();  // 执行工作循环
      break;  // 工作完成，退出循环
    } catch (thrownValue) {
      // 捕获错误，处理错误边界
      handleError(root, thrownValue);
    }
  } while (true);
  
  // 3. 检查是否完成
  if (workInProgress !== null) {
    return RootInProgress;  // 未完成（被中断），需要继续调度
  } else {
    return RootCompleted;  // 完成，可以进入 Commit Phase
  }
}
```

**第二步：工作循环**

`workLoopConcurrent` 是核心的工作循环，不断处理工作单元直到完成或被中断：

```ts
function workLoopConcurrent() {
  // 循环条件：
  // - workInProgress !== null：还有节点要处理
  // - !shouldYield()：时间片还没用完，不需要让出控制权
  while (workInProgress !== null && !shouldYield()) {
    // 处理单个工作单元（一个 Fiber 节点）
    // performUnitOfWork 会：
    // 1. 调用 beginWork 处理当前节点
    // 2. 如果有子节点，返回子节点
    // 3. 如果没有子节点，调用 completeUnitOfWork 完成当前节点
    // 4. 返回下一个要处理的节点（兄弟节点或父节点）
    workInProgress = performUnitOfWork(workInProgress);
  }
  
  // 退出循环的情况：
  // 1. workInProgress === null：所有节点处理完成
  // 2. shouldYield() === true：时间片用完，需要让出控制权
}
```

**执行流程示例**：

```bash
准备阶段
  ├─ prepareFreshStack(root, lanes)
  └─ workInProgress = root.current  // 指向根节点
  ↓
工作循环开始
  ├─ workInProgress = root（根节点）
  ├─ performUnitOfWork(root)
  │   ├─ beginWork(root) → 处理根节点
  │   └─ 返回 child（App 组件）
  ├─ workInProgress = App
  ├─ performUnitOfWork(App)
  │   ├─ beginWork(App) → 处理 App 组件
  │   └─ 返回 child（div）
  ├─ workInProgress = div
  ├─ performUnitOfWork(div)
  │   ├─ beginWork(div) → 处理 div
  │   └─ 返回 null（没有子节点）
  │   └─ completeUnitOfWork(div) → 完成 div
  │       └─ 返回 sibling 或 return
  └─ 继续处理下一个节点...
  ↓
完成或被中断
  ├─ workInProgress === null → 完成
  └─ shouldYield() === true → 中断，保存状态
```

### 中断机制

Render Phase 的核心特性是**可中断**。当时间片用完或有更高优先级的任务时，React 会中断当前工作，让出控制权。

**中断判断：何时让出控制权？**

```ts
function shouldYield(): boolean {
  // 计算已经使用的时间
  const timeElapsed = getCurrentTime() - startTime;
  
  // 如果时间还没用完（< 5ms），继续工作
  if (timeElapsed < frameInterval) {
    return false;  // 还有时间，继续工作
  }
  
  // 时间用完了，让出控制权
  // 让浏览器处理用户输入、动画等
  return true;  // 需要中断
}
```

**中断后的状态保存**：

当 `shouldYield()` 返回 `true` 时：
1. **保存当前状态**：`workInProgress` 指向当前正在处理的节点
2. **退出工作循环**：`workLoopConcurrent` 退出，但 `workInProgress` 不为 `null`
3. **返回未完成状态**：`renderRootConcurrent` 返回 `RootInProgress`
4. **调度恢复**：Scheduler 会在下一个时间片继续调度

**恢复机制**：

```bash
中断时：
  workInProgress = div（当前处理的节点）
  ↓
让出控制权给浏览器
  ├─ 浏览器处理用户输入
  ├─ 浏览器处理动画
  └─ 浏览器绘制
  ↓
下一个时间片开始
  ├─ performWorkUntilDeadline 被调用
  ├─ workLoopConcurrent 继续执行
  └─ 从 workInProgress（div）继续处理
```

**关键点**：

- **状态保存**：`workInProgress` 保存了中断位置，保证可以无缝恢复
- **时间分片**：每个时间片 5ms，避免长时间阻塞主线程
- **优先级响应**：高优先级任务可以立即中断低优先级任务

### 副作用收集

在 Render Phase，React 只**标记**副作用，不执行。这是 Render Phase 和 Commit Phase 分离的关键。

**为什么只标记不执行？**

1. **可中断性**：如果执行副作用（如 DOM 操作），中断后会导致状态不一致
2. **性能优化**：可以先收集所有副作用，然后一次性批量执行
3. **原子性保证**：所有副作用在 Commit Phase 一次性执行，保证界面一致性

**completeWork：完成节点工作**

`completeWork` 在完成一个节点时被调用，负责标记副作用：

```ts
function completeWork(
  current: Fiber | null,        // 当前树中的节点（旧节点）
  workInProgress: Fiber,        // 工作树中的节点（新节点）
  renderLanes: Lanes           // 当前渲染的优先级
): Fiber | null {
  const newProps = workInProgress.pendingProps;
  
  switch (workInProgress.tag) {
    case HostComponent: {  // DOM 元素节点
      if (current === null) {
        // 情况 1：新节点（首次渲染）
        // 创建 DOM 节点，但不插入到 DOM 树中
        const instance = createInstance(
          workInProgress.type,  // 'div', 'span' 等
          newProps,
          rootContainerInstance,
          currentHostContext,
          workInProgress
        );
        workInProgress.stateNode = instance;  // 保存 DOM 节点引用
        
        // 如果初始化子节点时需要更新，标记 Update
        if (finalizeInitialChildren(instance, newProps)) {
          markUpdate(workInProgress);  // 标记需要更新
        }
      } else {
        // 情况 2：更新节点
        // 对比新旧 props，如果不同，标记需要更新
        const oldProps = current.memoizedProps;
        if (oldProps !== newProps) {
          markUpdate(workInProgress);  // 标记 Update
          // 注意：这里只是标记，不实际更新 DOM
        }
      }
      break;
    }
  }
  
  return null;
}
```

**关键点**：

1. **创建但不插入**：新节点会被创建，但不会插入到 DOM 树中
2. **标记更新**：如果 props 变化，只标记 `Update` flag，不实际更新 DOM
3. **副作用收集**：所有副作用都被标记在 `workInProgress.flags` 中
4. **延迟执行**：真正的 DOM 操作在 Commit Phase 的 Mutation 阶段执行

**EffectList 的构建：副作用链表的收集**

EffectList 是一个链表，存储了所有需要执行的副作用。React 在 `completeUnitOfWork` 中构建这个链表。

**构建过程**：

```ts
// 在 completeUnitOfWork 中收集 effect
function completeUnitOfWork(unitOfWork: Fiber): Fiber | null {
  do {
    const returnFiber = unitOfWork.return;  // 父节点
    
    // 1. 完成当前节点的工作（标记副作用）
    const next = completeWork(/* ... */);
    
    // 2. 把当前节点的 effect 链到父节点
    if (returnFiber !== null) {
      // 2.1 链式连接子节点的 effect
      // 如果父节点还没有 effect，直接赋值
      if (returnFiber.firstEffect === null) {
        returnFiber.firstEffect = unitOfWork.firstEffect;
      }
      // 如果当前节点有子节点的 effect，链到父节点
      if (unitOfWork.lastEffect !== null) {
        if (returnFiber.lastEffect !== null) {
          // 父节点已有 effect，接在当前节点子节点的 effect 后面
          returnFiber.lastEffect.nextEffect = unitOfWork.firstEffect;
        }
        returnFiber.lastEffect = unitOfWork.lastEffect;
      }
      
      // 2.2 当前节点自己的 effect
      const flags = unitOfWork.flags;
      if (flags > PerformedWork) {  // 有副作用
        if (returnFiber.lastEffect !== null) {
          // 链到父节点 effect 链的末尾
          returnFiber.lastEffect.nextEffect = unitOfWork;
        } else {
          // 父节点还没有 effect，当前节点是第一个
          returnFiber.firstEffect = unitOfWork;
        }
        returnFiber.lastEffect = unitOfWork;
      }
    }
    
    // 3. 处理兄弟节点或向上回溯
    const siblingFiber = unitOfWork.sibling;
    if (siblingFiber !== null) {
      return siblingFiber;  // 有兄弟节点，处理兄弟节点
    }
    unitOfWork = returnFiber;  // 没有兄弟节点，向上回溯到父节点
  } while (unitOfWork !== null);
  
  return null;  // 回到根节点，工作完成
}
```

**EffectList 的构建示例**：

```bash
处理节点 A
  ├─ completeWork(A) → 标记 A 的 effect
  └─ 链到父节点
      └─ parent.firstEffect = A
          parent.lastEffect = A
  ↓
处理节点 B（A 的兄弟）
  ├─ completeWork(B) → 标记 B 的 effect
  └─ 链到父节点
      └─ parent.lastEffect.nextEffect = B
          parent.lastEffect = B
  ↓
最终 effectList：
  parent.firstEffect → A → B → null
  parent.lastEffect = B
```

**关键点**：

1. **自底向上收集**：从叶子节点开始，向上收集 effect
2. **链表结构**：每个节点通过 `nextEffect` 指向下一个 effect
3. **顺序保证**：effect 的执行顺序与收集顺序一致
4. **根节点汇总**：最终所有 effect 都汇总到根节点的 effectList

### Render Phase 中的 Hooks

在 Render Phase，Hooks 只执行**计算**，不执行**副作用**。这是理解 Hooks 执行时机的关键。

**Hooks 的执行时机**：

| Hook | Render Phase | Commit Phase |
|------|-------------|--------------|
| **useState** | ✅ 计算新状态 | ❌ |
| **useEffect** | ✅ 收集到 effectList | ✅ 执行（异步） |
| **useLayoutEffect** | ✅ 收集到 effectList | ✅ 执行（同步） |
| **useMemo** | ✅ 计算并缓存 | ❌ |
| **useCallback** | ✅ 返回函数引用 | ❌ |

**updateFunctionComponent：处理函数组件**

```ts
function updateFunctionComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  nextProps: any,
  renderLanes: Lanes
) {
  // 1. 重置 Hooks：准备执行 Hooks
  prepareToUseHooks(current, workInProgress);
  // 这一步会：
  // - 重置 workInProgressHook 指针
  // - 设置 currentlyRenderingFiber
  // - 准备 Hooks 的执行环境
  
  // 2. 执行组件函数：调用组件函数，执行所有 Hooks
  let nextChildren = renderWithHooks(
    current,
    workInProgress,
    Component,
    nextProps,
    context,
    renderLanes
  );
  // 在这个过程中：
  // - useState: 计算新状态，返回 [state, setState]
  // - useEffect: 收集 effect 到 effectList，不执行
  // - useMemo: 计算值并缓存
  // - useCallback: 返回函数引用
  // - useLayoutEffect: 收集 effect 到 effectList，不执行
  
  // 3. 协调子节点：对比新旧 children，标记更新
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  
  // 4. 返回第一个子节点：继续处理子节点
  return workInProgress.child;
}
```

**关键点**：

1. **计算阶段**：useState、useMemo 等在这里计算，得到新值
2. **收集阶段**：useEffect、useLayoutEffect 的 effect 被收集，但不执行
3. **执行阶段**：effect 的执行在 Commit Phase 进行
4. **可中断性**：如果 Render Phase 被中断，Hooks 的计算结果会被保存，下次继续

## Commit Phase：不可中断的提交

Commit Phase 的目标：**一次性应用所有更新到 DOM，执行生命周期，保证界面一致性**。

### 为什么不可中断？

如果 Commit Phase 可中断，用户可能看到：
- 部分 DOM 已更新，部分未更新
- 状态不一致的界面
- 闪烁或布局抖动

因此，Commit Phase 必须**原子性**执行。

### 三个阶段

Commit Phase 分为三个子阶段，按顺序执行，不可中断：

```ts
function commitRoot(root: FiberRoot) {
  // 1. Before Mutation：DOM 更新前
  // 执行需要在 DOM 更新前完成的副作用
  commitBeforeMutationEffects(root, finishedWork);
  // 主要工作：
  // - 执行 getSnapshotBeforeUpdate（类组件）
  // - 调度 useEffect（异步执行）
  
  // 2. Mutation：DOM 更新
  // 真正修改 DOM 的阶段
  commitMutationEffects(root, finishedWork, committedLanes);
  // 主要工作：
  // - 删除节点（Deletion）
  // - 插入节点（Placement）
  // - 更新节点（Update）
  // - 卸载 Ref
  
  // 3. Layout：DOM 更新后
  // 执行需要在 DOM 更新后同步执行的副作用
  commitLayoutEffects(finishedWork, root, committedLanes);
  // 主要工作：
  // - 挂载 Ref
  // - 执行 useLayoutEffect
  // - 执行 componentDidMount / componentDidUpdate
  
  // 4. 清理工作
  requestPaint();  // 请求浏览器重绘
  onCommitRoot(finishedWork.stateNode, root);  // 通知 DevTools 等
}
```

**三个阶段的关系**：

```bash
Before Mutation（DOM 更新前）
  ├─ 可以读取当前 DOM（还未更新）
  ├─ 执行 getSnapshotBeforeUpdate
  └─ 调度 useEffect（不立即执行）
  ↓
Mutation（DOM 更新）
  ├─ 删除旧节点
  ├─ 插入新节点
  └─ 更新节点属性
  ↓
Layout（DOM 更新后）
  ├─ DOM 已经更新完成
  ├─ 可以读取新 DOM
  ├─ 执行 useLayoutEffect
  └─ 执行生命周期
  ↓
浏览器绘制
  ↓
useEffect 执行（异步）
```

**为什么分成三个阶段？**

1. **Before Mutation**：需要在 DOM 更新前执行的操作（如快照）
2. **Mutation**：实际的 DOM 操作，必须一次性完成
3. **Layout**：需要在 DOM 更新后立即执行的操作（如测量、同步样式）

### Before Mutation：DOM 更新前

Before Mutation 阶段在 DOM 更新之前执行，主要用于执行需要在 DOM 更新前完成的操作。

**主要工作**：

1. **执行 getSnapshotBeforeUpdate**：类组件的生命周期方法
2. **调度 useEffect**：将 useEffect 放入任务队列，等待 DOM 更新后执行

**代码解析**：

```ts
function commitBeforeMutationEffects(
  root: FiberRoot,
  firstChild: Fiber
) {
  // 1. 执行 getSnapshotBeforeUpdate（类组件）
  // 遍历 effectList，找到所有类组件
  while (nextEffect !== null) {
    const current = nextEffect.alternate;  // 当前树中的节点
    
    if (current !== null) {
      // 这是一个更新操作（不是首次挂载）
      const prevProps = current.memoizedProps;  // 旧的 props
      const prevState = current.memoizedState;  // 旧的状态
      const instance = nextEffect.stateNode;    // 组件实例
      
      // 如果组件有 getSnapshotBeforeUpdate 方法，执行它
      if (typeof instance.getSnapshotBeforeUpdate === 'function') {
        // 在 DOM 更新前获取快照
        const snapshot = instance.getSnapshotBeforeUpdate(
          prevProps,
          prevState
        );
        // 保存快照，供 componentDidUpdate 使用
        nextEffect.updateQueue = snapshot;
      }
    }
    
    // 继续处理下一个 effect
    nextEffect = nextEffect.nextEffect;
  }
  
  // 2. 调度 useEffect（异步执行）
  // useEffect 不会立即执行，而是放入任务队列
  scheduleCallback(NormalPriority, () => {
    flushPassiveEffects();  // 执行所有 useEffect
  });
  // 注意：这里只是调度，不立即执行
  // useEffect 会在浏览器绘制后的微任务中执行
}
```

**为什么 useEffect 在这里调度？**

1. **异步特性**：`useEffect` 是异步的，不阻塞渲染和绘制
2. **执行时机**：在 Before Mutation 阶段调度，确保在 DOM 更新后执行
3. **性能优化**：不阻塞浏览器绘制，保证页面流畅
4. **任务队列**：使用 `scheduleCallback` 放入任务队列，在合适的时机执行

**getSnapshotBeforeUpdate 的使用场景**：

```tsx
class Component extends React.Component {
  getSnapshotBeforeUpdate(prevProps, prevState) {
    // DOM 更新前，可以读取当前的滚动位置
    if (prevProps.list.length < this.props.list.length) {
      const list = this.listRef.current;
      return list.scrollHeight - list.scrollTop;  // 返回快照
    }
    return null;
  }
  
  componentDidUpdate(prevProps, prevState, snapshot) {
    // DOM 更新后，使用快照恢复滚动位置
    if (snapshot !== null) {
      const list = this.listRef.current;
      list.scrollTop = list.scrollHeight - snapshot;
    }
  }
}
```

### Mutation：DOM 更新

Mutation 阶段是真正修改 DOM 的阶段。这是 Commit Phase 的核心，所有 DOM 操作都在这里完成。

**执行顺序的重要性**：

DOM 操作必须按照特定顺序执行，否则可能导致：
- DOM 结构不一致
- 布局抖动
- 性能问题

**代码解析**：

```ts
function commitMutationEffects(
  root: FiberRoot,
  finishedWork: Fiber,
  committedLanes: Lanes
) {
  // 遍历 effectList，按顺序处理所有副作用
  while (nextEffect !== null) {
    const flags = nextEffect.flags;  // 获取副作用标记
    
    // 1. 处理删除（优先处理，避免引用失效）
    if (flags & Deletion) {
      commitDeletion(root, nextEffect, returnFiber);
      // 删除操作包括：
      // - 卸载 Ref
      // - 递归删除子节点
      // - 从 DOM 中移除节点
    }
    
    // 2. 处理内容重置（文本节点内容变化）
    if (flags & ContentReset) {
      commitResetTextContent(nextEffect);
      // 重置文本节点的内容
    }
    
    // 3. 处理 Ref 卸载（在更新前卸载）
    if (flags & Ref) {
      const current = nextEffect.alternate;
      if (current !== null) {
        commitDetachRef(current);
        // 卸载旧的 Ref，避免引用失效的节点
      }
    }
    
    // 4. 处理插入和更新（最后处理）
    const primaryFlags = flags & (Placement | Update | Hydration);
    if (primaryFlags !== NoFlags) {
      const current = nextEffect.alternate;
      commitWork(current, nextEffect);
      // 包括：
      // - Placement：插入新节点
      // - Update：更新节点属性
      // - Hydration：服务端渲染的水合
    }
    
    // 继续处理下一个 effect
    nextEffect = nextEffect.nextEffect;
  }
}
```

**执行顺序的原因**：

1. **先删除**：避免引用失效的节点
2. **再重置**：重置文本内容
3. **卸载 Ref**：在更新前卸载旧的 Ref
4. **最后插入/更新**：确保 DOM 结构正确

**关键点**：

- **原子性**：所有 DOM 操作必须一次性完成，不能中断
- **顺序性**：按照 effectList 的顺序执行，保证一致性
- **完整性**：所有标记的副作用都必须执行

**处理 Placement（插入）**：

Placement 表示需要插入新节点到 DOM 中。

```ts
function commitPlacement(finishedWork: Fiber): void {
  // 1. 找到父节点（可能是 Portal）
  const parentFiber = getHostParentFiber(finishedWork);
  const parent = parentFiber.stateNode;  // DOM 元素
  
  // 2. 找到插入位置（参考节点）
  // 用于确定新节点应该插入在哪里
  const before = getHostSibling(finishedWork);
  
  // 3. 插入 DOM
  if (isContainer) {
    // 插入到容器（如 root）
    insertOrAppendPlacementNodeIntoContainer(finishedWork, before, parent);
  } else {
    // 插入到普通父节点
    insertOrAppendPlacementNode(finishedWork, before, parent);
  }
  // 这一步会：
  // - 如果 before 存在，插入到 before 之前
  // - 如果 before 不存在，追加到 parent 末尾
}
```

**插入过程示例**：

```jsx
新节点：<div>New</div>
父节点：<div id="parent">
参考节点：<div>Old</div>

插入后：
<div id="parent">
  <div>New</div>  ← 插入到这里
  <div>Old</div>
</div>
```

**处理 Update（更新）**：

Update 表示需要更新现有节点的属性。

```ts
function commitWork(current: Fiber | null, finishedWork: Fiber): void {
  switch (finishedWork.tag) {
    case HostComponent: {  // DOM 元素节点
      const instance: Instance = finishedWork.stateNode;  // DOM 元素
      if (instance != null) {
        const newProps = finishedWork.memoizedProps;  // 新的 props
        const oldProps = current !== null ? current.memoizedProps : newProps;
        
        // 更新 DOM 属性
        commitUpdate(
          instance,
          updatePayload,  // 需要更新的属性列表（在 Render Phase 计算）
          type,
          oldProps,
          newProps,
          finishedWork
        );
        // 这一步会：
        // - 更新 className、style、onClick 等属性
        // - 只更新变化的属性，不更新所有属性
      }
      return;
    }
    case HostText: {  // 文本节点
      const textInstance = finishedWork.stateNode;
      const newText = finishedWork.memoizedProps;  // 新的文本内容
      const oldText = current !== null ? current.memoizedProps : newText;
      
      // 更新文本内容
      commitTextUpdate(textInstance, oldText, newText);
      // 如果文本内容没变，可能跳过更新
      return;
    }
  }
}
```

**更新过程示例**：

```jsx
旧节点：<div className="old">Text</div>
新节点：<div className="new">Text</div>

更新后：
<div className="new">Text</div>  ← className 已更新
```

**处理 Deletion（删除）**：

Deletion 表示需要从 DOM 中删除节点。

```ts
function commitDeletion(
  root: FiberRoot,
  returnFiber: Fiber,      // 父节点
  deletedFiber: Fiber      // 要删除的节点
): void {
  // 1. 卸载 Ref（避免引用失效的节点）
  detachFiberMutation(deletedFiber);
  // 如果节点有 Ref，先卸载 Ref
  
  // 2. 递归删除子节点
  // 需要找到真正的 DOM 父节点（可能是 Portal）
  let parent = returnFiber;
  findParent: while (parent !== null) {
    switch (parent.tag) {
      case HostComponent: {
        // 找到 DOM 父节点
        const parentInstance = parent.stateNode;
        // 从 DOM 中移除
        removeChildFromContainer(parentInstance, deletedFiber.stateNode);
        return;
      }
      case HostPortal: {
        // Portal 节点，继续向上查找
        parent = parent.return;
        continue findParent;
      }
    }
    parent = parent.return;
  }
}
```

**删除过程示例**：

```jsx
删除前：
<div id="parent">
  <div>Keep</div>
  <div id="delete">Delete</div>  ← 要删除
</div>

删除后：
<div id="parent">
  <div>Keep</div>
</div>
```

**关键点**：

1. **插入顺序**：按照 effectList 的顺序插入，保证 DOM 结构正确
2. **更新优化**：只更新变化的属性，不更新所有属性
3. **删除递归**：删除节点时，会递归删除所有子节点
4. **Portal 支持**：正确处理 Portal 节点的插入和删除

### Layout：DOM 更新后

Layout 阶段在 DOM 更新完成后执行，主要用于执行需要在 DOM 更新后立即同步执行的操作。

**主要工作**：

1. **挂载 Ref**：在 DOM 更新后挂载 Ref，可以安全访问 DOM
2. **执行 useLayoutEffect**：同步执行，阻塞浏览器绘制
3. **执行生命周期**：componentDidMount、componentDidUpdate

**为什么在 DOM 更新后执行？**

- DOM 已经更新完成，可以安全读取和操作
- 需要同步执行，保证在浏览器绘制前完成
- 适合需要立即生效的操作（如测量 DOM、同步样式）

**代码解析**：

```ts
function commitLayoutEffects(
  finishedWork: Fiber,
  root: FiberRoot,
  committedLanes: Lanes
) {
  // 遍历 effectList，执行所有 Layout 相关的副作用
  while (nextEffect !== null) {
    const flags = nextEffect.flags;
    
    // 1. 处理 Ref 挂载
    if (flags & Ref) {
      commitAttachRef(nextEffect);
      // 在 DOM 更新后挂载 Ref，可以安全访问 DOM 元素
      // ref.current = DOM 元素
    }
    
    // 2. 执行 useLayoutEffect 和生命周期
    if (flags & Update) {
      const current = nextEffect.alternate;
      commitLifeCycles(root, current, nextEffect);
      // 执行：
      // - useLayoutEffect（函数组件）
      // - componentDidMount / componentDidUpdate（类组件）
    }
    
    // 继续处理下一个 effect
    nextEffect = nextEffect.nextEffect;
  }
}
```

**执行生命周期**：

```ts
function commitLifeCycles(
  finishedRoot: FiberRoot,
  current: Fiber | null,
  finishedWork: Fiber,
  committedLanes: Lanes
): void {
  switch (finishedWork.tag) {
    case FunctionComponent: {
      // 函数组件：执行 useLayoutEffect
      commitHookEffectListMount(HookLayout | HookHasEffect, finishedWork);
      // 遍历 effectList，执行所有 useLayoutEffect
      // 这些 effect 在 Render Phase 被收集，现在执行
      return;
    }
    case ClassComponent: {
      // 类组件：执行生命周期方法
      const instance = finishedWork.stateNode;
      if (finishedWork.flags & Update) {
        if (current === null) {
          // 首次挂载：执行 componentDidMount
          instance.componentDidMount();
        } else {
          // 更新：执行 componentDidUpdate
          const prevProps = finishedWork.elementType === finishedWork.type
            ? current.memoizedProps
            : resolveDefaultProps(finishedWork.type, current.memoizedProps);
          const prevState = current.memoizedState;
          // 传入 getSnapshotBeforeUpdate 的快照
          instance.componentDidUpdate(
            prevProps,
            prevState,
            instance.__reactInternalSnapshotBeforeUpdate
          );
        }
      }
      return;
    }
  }
}
```

**执行顺序**：

```bash
Layout 阶段开始
  ↓
遍历 effectList
  ├─ 挂载 Ref（如果有）
  ├─ 执行 useLayoutEffect（函数组件）
  └─ 执行生命周期（类组件）
  ↓
Layout 阶段结束
  ↓
浏览器绘制
  ↓
useEffect 执行（异步）
```

**关键点**：

1. **同步执行**：所有操作都是同步的，阻塞浏览器绘制
2. **DOM 可用**：DOM 已经更新完成，可以安全访问
3. **顺序保证**：按照 effectList 的顺序执行
4. **性能影响**：如果 useLayoutEffect 执行时间过长，会阻塞绘制

**useLayoutEffect vs useEffect**：

| 特性 | useLayoutEffect | useEffect |
|------|----------------|-----------|
| **执行时机** | Layout 阶段（同步） | 异步（微任务） |
| **阻塞渲染** | ✅ 阻塞浏览器绘制 | ❌ 不阻塞 |
| **使用场景** | DOM 测量、同步样式 | 数据获取、订阅 |
| **执行顺序** | 在浏览器绘制前 | 在浏览器绘制后 |

## 浏览器绘制控制机制

**为什么 React 能够控制浏览器绘制时机？**

浏览器不会在每次 DOM 修改后立即绘制，而是等待当前执行栈清空后再绘制。React 利用这个机制，通过控制 Commit Phase 中同步代码和异步代码的执行时机，精确控制浏览器何时进行绘制。

### 浏览器事件循环机制

浏览器的事件循环遵循以下顺序：

```bash
1. 执行同步代码（执行栈）
2. 执行微任务（Promise、queueMicrotask）
3. 执行宏任务（setTimeout、MessageChannel）
4. 浏览器渲染（绘制）
5. 重复步骤 1
```

**关键点**：浏览器只在**执行栈清空**后才会进行渲染。这意味着：

- 如果执行栈中有同步代码在执行，浏览器会等待
- 只有执行栈清空后，浏览器才会检查是否需要绘制
- React 可以通过控制同步/异步代码的执行时机来控制绘制

### Commit Phase 与浏览器绘制的交互

Commit Phase 的三个子阶段通过不同的执行策略，实现了对浏览器绘制时机的精确控制：

**完整的执行流程**：

```bash
1. Before Mutation 阶段（同步执行）
   ├─ 执行 getSnapshotBeforeUpdate（类组件）
   ├─ 调度异步副作用（如 useEffect）
   │   └─ scheduleCallback → 放入任务队列（不立即执行）
   └─ 执行栈未清空，继续执行
  ↓
2. Mutation 阶段（同步执行）
   ├─ 删除旧节点
   ├─ 插入新节点
   ├─ 更新节点属性
   └─ DOM 已修改，但执行栈未清空
  ↓
3. Layout 阶段（同步执行）
   ├─ 挂载 Ref
   ├─ 执行同步副作用（如 useLayoutEffect、componentDidMount）
   │   └─ 这些代码是同步执行的，在执行栈中
   └─ 执行栈未清空，继续执行
  ↓
4. Commit Phase 执行完毕
   └─ 执行栈清空
  ↓
5. 浏览器检查是否需要渲染
   ├─ DOM 已修改 ✅
   ├─ 执行栈已清空 ✅
   └─ 开始渲染（绘制）✅
  ↓
6. 微任务执行
   └─ 执行异步副作用（如 useEffect）
       └─ 如果修改了 DOM，浏览器会再次绘制
```

### 同步执行 vs 异步执行

**同步执行（Layout 阶段）**：

Layout 阶段的所有操作都是**同步执行**的，包括：
- `useLayoutEffect` 的回调函数
- 类组件的 `componentDidMount`、`componentDidUpdate`
- Ref 的挂载

这些操作在执行栈中，会阻塞浏览器绘制：

```bash
Commit Phase（同步执行）
  ├─ Mutation：更新 DOM
  ├─ Layout：执行同步副作用
  │   ├─ useLayoutEffect 回调（同步）
  │   ├─ componentDidMount（同步）
  │   └─ 如果这些操作耗时，浏览器会一直等待
  └─ 执行栈清空
  ↓
浏览器绘制 ✅（延迟到同步代码执行完毕）
```

**异步执行（Before Mutation 阶段调度）**：

Before Mutation 阶段会调度异步副作用，包括：
- `useEffect` 的回调函数
- 其他通过 `scheduleCallback` 调度的任务

这些操作不在执行栈中，而是放入任务队列，不会阻塞浏览器绘制：

```bash
Commit Phase（同步执行）
  ├─ Before Mutation：调度异步副作用
  │   └─ scheduleCallback → 放入任务队列（不立即执行）
  ├─ Mutation：更新 DOM
  ├─ Layout：执行同步副作用
  └─ 执行栈清空
  ↓
浏览器绘制 ✅（立即绘制，不等待异步任务）
  ↓
微任务执行
  └─ 执行异步副作用（如 useEffect）
```

### React 控制绘制时机的策略

React 通过以下策略控制浏览器绘制时机：

1. **DOM 更新时机**：
   - `Mutation` 阶段同步更新 DOM
   - DOM 修改不会立即触发绘制，浏览器会等待执行栈清空

2. **同步副作用时机**：
   - `Layout` 阶段同步执行需要立即生效的操作
   - 这些操作在执行栈中，会阻塞浏览器绘制
   - 适合需要测量 DOM、同步样式等场景

3. **异步副作用时机**：
   - `Before Mutation` 阶段调度异步副作用
   - 这些操作不在执行栈中，不阻塞浏览器绘制
   - 适合数据获取、订阅等不紧急的场景

### 实际执行时间线

**场景：包含同步和异步副作用的更新**

```bash
0ms:   Commit Phase 开始
0ms:   Before Mutation：调度 useEffect（放入任务队列）
0ms:   Mutation：更新 DOM
0ms:   Layout：执行 useLayoutEffect（同步，假设耗时 50ms）
50ms:  Layout 结束
50ms:  执行栈清空
50ms:  浏览器绘制 ✅（延迟了 50ms）
50ms:  微任务执行：useEffect 开始执行
```

**关键点**：

- `Mutation` 阶段更新 DOM，但浏览器不会立即绘制
- `Layout` 阶段的同步代码会阻塞绘制，直到执行完毕
- `Before Mutation` 阶段调度的异步代码不会阻塞绘制
- 浏览器只在执行栈清空后才会绘制

### requestPaint：通知浏览器需要绘制

在 Commit Phase 的最后，React 会调用 `requestPaint()` 来通知浏览器需要绘制。这个函数的作用机制如下：

**requestPaint 的实现原理**：

```ts
// React 内部的实现（简化版）
let needsPaint = false;

function requestPaint(): void {
  // 设置标志位，标记需要绘制
  needsPaint = true;
}
```

**为什么调用 requestPaint 就能触发浏览器渲染？**

`requestPaint` 本身**并不直接触发**浏览器渲染，而是通过以下机制间接影响浏览器绘制：

1. **设置绘制标志**：
   - `requestPaint` 设置 `needsPaint = true`，标记 DOM 已更新，需要绘制
   - 这个标志位会被 React Scheduler 使用，在 `shouldYield` 中检查

2. **`Scheduler` 的绘制检查**：

```ts
function shouldYieldToHost(): boolean {
  const timeElapsed = getCurrentTime() - startTime;
  
  // 如果时间还没用完，继续工作
  if (timeElapsed < frameInterval) {
    return false;
  }
  
  // 关键：检查是否需要绘制
  if (needsPaint) {
    return true;  // 需要绘制，立即让出控制权给浏览器
  }
  
  // 其他检查...
  return timeElapsed > frameInterval;
}
```

3. **浏览器事件循环的渲染阶段**：

```bash
执行栈清空
  ↓
浏览器检查是否需要渲染
  ├─ DOM 已修改 ✅（Mutation 阶段修改的）
  ├─ 执行栈已清空 ✅
  └─ 开始渲染（绘制）✅
```

**完整的交互流程**：

```bash
1. Commit Phase 执行
   ├─ Mutation：更新 DOM
   ├─ Layout：执行同步副作用
   └─ requestPaint()：设置 needsPaint = true
  ↓
2. Commit Phase 结束，执行栈清空
  ↓
3. 浏览器事件循环进入渲染阶段
   ├─ 检查 DOM 是否有变化 ✅
   ├─ 检查执行栈是否清空 ✅
   └─ 开始渲染（绘制）✅
  ↓
4. 如果后续有 Render Phase 工作
   ├─ shouldYieldToHost() 检查 needsPaint
   ├─ 如果 needsPaint === true，立即让出控制权
   └─ 让浏览器优先进行绘制
```

**requestPaint 的作用**：

1. **性能优化**：告诉 Scheduler 有绘制需求，在时间分片时优先让出控制权
2. **时机标记**：标记 DOM 已更新，浏览器可以在合适的时机绘制
3. **协调机制**：协调 React 的工作和浏览器的绘制，避免不必要的绘制

**关键理解**：

- `requestPaint` **不是**直接触发浏览器渲染的函数
- 它只是**标记**需要绘制，浏览器会在事件循环的渲染阶段自然检查并绘制
- 它的主要作用是**通知 Scheduler**，在后续的时间分片中优先让出控制权给浏览器

**类比理解**：

想象你在排队：
- **Mutation/Layout 阶段**：你在做自己的工作（更新 DOM）
- **requestPaint**：你举手示意"我完成了，可以展示我的成果了"
- **浏览器事件循环**：管理员看到你举手，在合适的时机（执行栈清空后）展示你的成果
- **Scheduler**：如果后续还有工作，看到你举过手，会优先让管理员展示成果

这就是 `requestPaint` 如何"触发"浏览器渲染的机制：它通过标记和协调，让浏览器在合适的时机进行绘制。

### 设计原理

这种设计的核心思想是：

1. **原子性保证**：Commit Phase 的所有同步操作必须一次性完成，保证界面一致性
2. **性能优化**：异步副作用不阻塞绘制，保证页面流畅
3. **时机控制**：通过同步/异步的区分，精确控制浏览器绘制时机
4. **灵活性**：开发者可以根据需求选择同步或异步副作用

**类比理解**：

想象你在装修房子：
- **Mutation 阶段**：同步完成所有结构改造（拆墙、砌墙）
- **Layout 阶段**：同步完成需要立即生效的装修（测量、调整）
- **异步副作用**：异步完成不紧急的装修（采购、预约）

只有所有同步工作完成后，才能"展示"给用户看。这就是 React 控制浏览器绘制时机的根本原理。

## 完整流程示例

```tsx
function App() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    console.log('Effect:', count);
  }, [count]);
  
  useLayoutEffect(() => {
    console.log('Layout Effect:', count);
  }, [count]);
  
  return <div>{count}</div>;
}
```

**执行流程详解**：

让我们逐步分析这个示例的完整执行过程：

```bash
1. 用户交互
用户点击按钮 → setCount(1)
  ↓
2. 调度更新
dispatchSetState → scheduleUpdateOnFiber → ensureRootIsScheduled
  ↓
3. Render Phase（可中断）
  ├─ renderRootConcurrent 开始
  ├─ prepareFreshStack：准备 workInProgress 树
  └─ workLoopConcurrent 开始工作
      ↓
      beginWork(App)
      ├─ updateFunctionComponent
      │   ├─ prepareToUseHooks：重置 Hooks 环境
      │   └─ renderWithHooks：执行组件函数
      │       ├─ useState(0)
      │       │   └─ updateReducer → 计算新状态 count = 1
      │       ├─ useEffect(() => {...}, [count])
      │       │   └─ updateEffect → 收集 effect 到 effectList（不执行）
      │       └─ useLayoutEffect(() => {...}, [count])
      │           └─ updateLayoutEffect → 收集 effect 到 effectList（不执行）
      └─ reconcileChildren：对比 children，标记更新
      ↓
      beginWork(div)
      ├─ updateHostComponent
      └─ reconcileChildren：对比文本节点
      ↓
      completeUnitOfWork
      ├─ completeWork(div)：标记 Update
      ├─ completeWork(App)：收集 effectList
      └─ 构建 effectList：App → div
  ↓
4. Commit Phase（不可中断）
  ├─ commitRoot 开始
  │
  ├─ Before Mutation 阶段
  │   ├─ commitBeforeMutationEffects
  │   ├─ 执行 getSnapshotBeforeUpdate（如果有类组件）
  │   └─ scheduleCallback(NormalPriority, flushPassiveEffects)
  │       └─ useEffect 被调度到任务队列（不立即执行）
  │
  ├─ Mutation 阶段
  │   ├─ commitMutationEffects
  │   ├─ 遍历 effectList
  │   └─ commitWork(div)
  │       └─ commitUpdate：更新 DOM 文本内容
  │           └─ <div>0</div> → <div>1</div> ✅
  │
  └─ Layout 阶段
      ├─ commitLayoutEffects
      ├─ 遍历 effectList
      ├─ commitAttachRef（如果有 Ref）
      └─ commitLifeCycles(App)
          └─ commitHookEffectListMount
              └─ 执行 useLayoutEffect ✅
                  └─ console.log('Layout Effect:', 1)
  ↓
5. 浏览器绘制
浏览器读取 DOM，绘制到屏幕
  ↓
6. 微任务执行
微任务队列中的 useEffect 执行 ✅
  └─ console.log('Effect:', 1)
```

**关键时间点**：

| 时间点 | 操作 | DOM 状态 | 可见性 |
|--------|------|----------|--------|
| **Render Phase** | 计算状态、收集 effect | 未更新 | 不可见 |
| **Before Mutation** | 调度 useEffect | 未更新 | 不可见 |
| **Mutation** | 更新 DOM | 已更新 | 不可见（未绘制） |
| **Layout** | 执行 useLayoutEffect | 已更新 | 不可见（未绘制） |
| **浏览器绘制** | 绘制到屏幕 | 已更新 | **可见** ✅ |
| **微任务** | 执行 useEffect | 已更新 | 可见 |

**useLayoutEffect vs useEffect 的区别**：

- **useLayoutEffect**：在浏览器绘制**前**执行，会阻塞绘制
- **useEffect**：在浏览器绘制**后**执行，不阻塞绘制

这就是为什么 useLayoutEffect 适合测量 DOM、同步样式等需要立即生效的操作。

## 总结

Render Phase 和 Commit Phase 的设计体现了 React 的核心思想：

1. **分离关注点**：计算与 DOM 操作分离
2. **可中断渲染**：Render Phase 支持时间分片，不阻塞用户交互
3. **原子性提交**：Commit Phase 保证界面一致性
4. **优先级调度**：高优先级任务可以打断低优先级任务

这种设计让 React 能够实现并发渲染，在保持性能的同时，提供流畅的用户体验。

