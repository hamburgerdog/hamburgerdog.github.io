---
title: React Render Phase 与 Commit Phase
subtitle: 可中断渲染与不可中断提交
date: 2025-12-25 12:00:00 +0800
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

```ts
function renderRootConcurrent(root: FiberRoot, lanes: Lanes) {
  // 1. 准备渲染
  prepareFreshStack(root, lanes);
  
  // 2. 开始工作循环
  do {
    try {
      workLoopConcurrent();
      break;  // 完成
    } catch (thrownValue) {
      handleError(root, thrownValue);
    }
  } while (true);
  
  // 3. 检查是否完成
  if (workInProgress !== null) {
    return RootInProgress;  // 未完成，需要继续
  } else {
    return RootCompleted;  // 完成
  }
}

function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    // 处理单个工作单元
    workInProgress = performUnitOfWork(workInProgress);
  }
}
```

### 中断机制

```ts
function shouldYield(): boolean {
  // 检查当前时间片是否用完
  const timeElapsed = getCurrentTime() - startTime;
  
  if (timeElapsed < frameInterval) {
    // 还有时间，继续工作
    return false;
  }
  
  // 时间用完了，让出控制权
  // 浏览器可以处理用户输入、动画等
  return true;
}

// 中断后，React 会保存当前状态
// workInProgress 指向当前处理的节点
// 下次恢复时，从这个节点继续
```

### 副作用收集

在 Render Phase，React 只**标记**副作用，不执行：

```ts
function completeWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
): Fiber | null {
  const newProps = workInProgress.pendingProps;
  
  switch (workInProgress.tag) {
    case HostComponent: {
      // 1. 创建 DOM 节点（但不插入）
      if (current === null) {
        const instance = createInstance(
          workInProgress.type,
          newProps,
          rootContainerInstance,
          currentHostContext,
          workInProgress
        );
        workInProgress.stateNode = instance;
        
        // 标记需要插入
        if (finalizeInitialChildren(instance, newProps)) {
          markUpdate(workInProgress);  // 标记 Update
        }
      } else {
        // 2. 更新属性（但不应用到 DOM）
        const oldProps = current.memoizedProps;
        if (oldProps !== newProps) {
          markUpdate(workInProgress);  // 标记 Update
        }
      }
      break;
    }
  }
  
  return null;
}
```

**EffectList 的构建**：

```ts
// 在 completeUnitOfWork 中收集 effect
function completeUnitOfWork(unitOfWork: Fiber): Fiber | null {
  do {
    const returnFiber = unitOfWork.return;
    
    // 完成当前节点
    const next = completeWork(/* ... */);
    
    // 把当前节点的 effect 链到父节点
    if (returnFiber !== null) {
      // 链式连接 effect
      if (returnFiber.firstEffect === null) {
        returnFiber.firstEffect = unitOfWork.firstEffect;
      }
      if (unitOfWork.lastEffect !== null) {
        if (returnFiber.lastEffect !== null) {
          returnFiber.lastEffect.nextEffect = unitOfWork.firstEffect;
        }
        returnFiber.lastEffect = unitOfWork.lastEffect;
      }
      
      // 当前节点自己的 effect
      const flags = unitOfWork.flags;
      if (flags > PerformedWork) {
        if (returnFiber.lastEffect !== null) {
          returnFiber.lastEffect.nextEffect = unitOfWork;
        } else {
          returnFiber.firstEffect = unitOfWork;
        }
        returnFiber.lastEffect = unitOfWork;
      }
    }
    
    // 处理兄弟节点或向上回溯
    const siblingFiber = unitOfWork.sibling;
    if (siblingFiber !== null) {
      return siblingFiber;
    }
    unitOfWork = returnFiber;
  } while (unitOfWork !== null);
  
  return null;
}
```

### Render Phase 中的 Hooks

在 Render Phase，Hooks 只执行计算，不执行副作用：

```ts
function updateFunctionComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: any,
  nextProps: any,
  renderLanes: Lanes
) {
  // 重置 Hooks
  prepareToUseHooks(current, workInProgress);
  
  // 执行组件函数
  let nextChildren = renderWithHooks(
    current,
    workInProgress,
    Component,
    nextProps,
    context,
    renderLanes
  );
  
  // useState: 计算新状态
  // useEffect: 收集到 effectList，不执行
  // useMemo: 计算并缓存
  // useCallback: 返回函数引用
  
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}
```

## Commit Phase：不可中断的提交

Commit Phase 的目标：**一次性应用所有更新到 DOM，执行生命周期，保证界面一致性**。

### 为什么不可中断？

如果 Commit Phase 可中断，用户可能看到：
- 部分 DOM 已更新，部分未更新
- 状态不一致的界面
- 闪烁或布局抖动

因此，Commit Phase 必须**原子性**执行。

### 三个阶段

Commit Phase 分为三个子阶段：

```ts
function commitRoot(root: FiberRoot) {
  // 1. Before Mutation：DOM 更新前
  commitBeforeMutationEffects(root, finishedWork);
  
  // 2. Mutation：DOM 更新
  commitMutationEffects(root, finishedWork, committedLanes);
  
  // 3. Layout：DOM 更新后
  commitLayoutEffects(finishedWork, root, committedLanes);
  
  // 4. 清理工作
  requestPaint();  // 请求浏览器重绘
  onCommitRoot(finishedWork.stateNode, root);
}
```

### Before Mutation：DOM 更新前

执行需要在 DOM 更新前完成的副作用：

```ts
function commitBeforeMutationEffects(
  root: FiberRoot,
  firstChild: Fiber
) {
  // 1. 执行 getSnapshotBeforeUpdate（类组件）
  while (nextEffect !== null) {
    const current = nextEffect.alternate;
    
    if (current !== null) {
      const prevProps = current.memoizedProps;
      const prevState = current.memoizedState;
      const instance = nextEffect.stateNode;
      
      if (
        typeof instance.getSnapshotBeforeUpdate === 'function'
      ) {
        const snapshot = instance.getSnapshotBeforeUpdate(
          prevProps,
          prevState
        );
        nextEffect.updateQueue = snapshot;
      }
    }
    
    nextEffect = nextEffect.nextEffect;
  }
  
  // 2. 调度 useEffect（异步执行）
  scheduleCallback(NormalPriority, () => {
    flushPassiveEffects();
  });
}
```

**为什么 useEffect 在这里调度？**

- `useEffect` 是**异步**的，不阻塞渲染
- 在 Before Mutation 阶段调度，确保在 DOM 更新后执行
- 使用 `scheduleCallback` 放入任务队列，不立即执行

### Mutation：DOM 更新

这是真正修改 DOM 的阶段：

```ts
function commitMutationEffects(
  root: FiberRoot,
  finishedWork: Fiber,
  committedLanes: Lanes
) {
  // 遍历 effectList
  while (nextEffect !== null) {
    const flags = nextEffect.flags;
    
    // 1. 处理删除
    if (flags & Deletion) {
      commitDeletion(root, nextEffect, returnFiber);
    }
    
    // 2. 处理内容重置
    if (flags & ContentReset) {
      commitResetTextContent(nextEffect);
    }
    
    // 3. 处理 Ref 卸载
    if (flags & Ref) {
      const current = nextEffect.alternate;
      if (current !== null) {
        commitDetachRef(current);
      }
    }
    
    // 4. 处理插入和更新
    const primaryFlags = flags & (Placement | Update | Hydration);
    if (primaryFlags !== NoFlags) {
      const current = nextEffect.alternate;
      commitWork(current, nextEffect);
    }
    
    nextEffect = nextEffect.nextEffect;
  }
}
```

**处理 Placement（插入）**：

```ts
function commitPlacement(finishedWork: Fiber): void {
  const parentFiber = getHostParentFiber(finishedWork);
  const parent = parentFiber.stateNode;
  
  // 找到插入位置
  const before = getHostSibling(finishedWork);
  
  // 插入 DOM
  if (isContainer) {
    insertOrAppendPlacementNodeIntoContainer(finishedWork, before, parent);
  } else {
    insertOrAppendPlacementNode(finishedWork, before, parent);
  }
}
```

**处理 Update（更新）**：

```ts
function commitWork(current: Fiber | null, finishedWork: Fiber): void {
  switch (finishedWork.tag) {
    case HostComponent: {
      const instance: Instance = finishedWork.stateNode;
      if (instance != null) {
        const newProps = finishedWork.memoizedProps;
        const oldProps = current !== null ? current.memoizedProps : newProps;
        
        // 更新 DOM 属性
        commitUpdate(
          instance,
          updatePayload,
          type,
          oldProps,
          newProps,
          finishedWork
        );
      }
      return;
    }
    case HostText: {
      const textInstance = finishedWork.stateNode;
      const newText = finishedWork.memoizedProps;
      const oldText = current !== null ? current.memoizedProps : newText;
      
      // 更新文本内容
      commitTextUpdate(textInstance, oldText, newText);
      return;
    }
  }
}
```

**处理 Deletion（删除）**：

```ts
function commitDeletion(
  root: FiberRoot,
  returnFiber: Fiber,
  deletedFiber: Fiber
): void {
  // 1. 卸载 Ref
  detachFiberMutation(deletedFiber);
  
  // 2. 递归删除子节点
  let parent = returnFiber;
  findParent: while (parent !== null) {
    switch (parent.tag) {
      case HostComponent: {
        const parentInstance = parent.stateNode;
        // 从 DOM 中移除
        removeChildFromContainer(parentInstance, deletedFiber.stateNode);
        return;
      }
    }
    parent = parent.return;
  }
}
```

### Layout：DOM 更新后

执行需要在 DOM 更新后同步执行的副作用：

```ts
function commitLayoutEffects(
  finishedWork: Fiber,
  root: FiberRoot,
  committedLanes: Lanes
) {
  while (nextEffect !== null) {
    const flags = nextEffect.flags;
    
    // 1. 处理 Ref 挂载
    if (flags & Ref) {
      commitAttachRef(nextEffect);
    }
    
    // 2. 执行 useLayoutEffect
    if (flags & Update) {
      const current = nextEffect.alternate;
      commitLifeCycles(root, current, nextEffect);
    }
    
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
      // 执行 useLayoutEffect
      commitHookEffectListMount(HookLayout | HookHasEffect, finishedWork);
      return;
    }
    case ClassComponent: {
      const instance = finishedWork.stateNode;
      if (finishedWork.flags & Update) {
        if (current === null) {
          // 首次挂载
          instance.componentDidMount();
        } else {
          // 更新
          const prevProps = finishedWork.elementType === finishedWork.type
            ? current.memoizedProps
            : resolveDefaultProps(finishedWork.type, current.memoizedProps);
          const prevState = current.memoizedState;
          instance.componentDidUpdate(prevProps, prevState, instance.__reactInternalSnapshotBeforeUpdate);
        }
      }
      return;
    }
  }
}
```

**useLayoutEffect vs useEffect**：

| 特性 | useLayoutEffect | useEffect |
|------|----------------|-----------|
| **执行时机** | Layout 阶段（同步） | 异步（微任务） |
| **阻塞渲染** | ✅ 阻塞浏览器绘制 | ❌ 不阻塞 |
| **使用场景** | DOM 测量、同步样式 | 数据获取、订阅 |
| **执行顺序** | 在浏览器绘制前 | 在浏览器绘制后 |

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

**执行流程**：

```
用户点击 → setCount(1)
  ↓
Render Phase（可中断）
  ├─ beginWork(App)
  │   ├─ renderWithHooks
  │   │   ├─ useState: 计算新状态 count = 1
  │   │   ├─ useEffect: 收集到 effectList（不执行）
  │   │   └─ useLayoutEffect: 收集到 effectList（不执行）
  │   └─ reconcileChildren
  ├─ beginWork(div)
  └─ completeUnitOfWork
      └─ 收集 effectList
  ↓
Commit Phase（不可中断）
  ├─ Before Mutation
  │   └─ 调度 useEffect（异步）
  ├─ Mutation
  │   └─ 更新 DOM: <div>1</div>
  └─ Layout
      ├─ useLayoutEffect 执行 ✅
      └─ console.log('Layout Effect:', 1)
  ↓
浏览器绘制
  ↓
微任务队列
  └─ useEffect 执行 ✅
      └─ console.log('Effect:', 1)
```

## 总结

Render Phase 和 Commit Phase 的设计体现了 React 的核心思想：

1. **分离关注点**：计算与 DOM 操作分离
2. **可中断渲染**：Render Phase 支持时间分片，不阻塞用户交互
3. **原子性提交**：Commit Phase 保证界面一致性
4. **优先级调度**：高优先级任务可以打断低优先级任务

这种设计让 React 能够实现并发渲染，在保持性能的同时，提供流畅的用户体验。

