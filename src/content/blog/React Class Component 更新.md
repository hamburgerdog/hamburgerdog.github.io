---
title: React Class Component 更新
subtitle: 各类更新触发方式
date: 2025-12-17 15:00:00 +0800
tags: 前端
remark: 'React Class Component 更新机制详解，包含 setState 主动更新、Props 被动更新、挂载和卸载流程，以及 Context 订阅更新的完整流程'
---

# React Class Component 更新

React Class Component 的更新机制是 React 协调系统的核心部分。触发更新的核心都是构造 Update 对象并挂载到 Fiber 的队列上，类组件在原型上实现了一个 `React.Component.prototype.setState` 方法作为更新入口。

## setState 更新流程

当调用 `setState` 时，React 会执行以下步骤：

1. **创建 Update 对象**：`setState` 会创建一个 Update 对象，用于记录状态变更
2. **加入更新队列**：Update 对象被添加到 Fiber 节点的 `updateQueue` 队列上，管理所有未处理的更新
3. **调度更新**：调用 `scheduleUpdateOnFiber` 执行两个关键过程
   - 使用 `lane` 标记当前 Fiber 以及父组件直到树根，表示需要更新
   - 发起一次渲染工作，直到批处理结束合并所有操作，此时进入到 Scheduler 后等待合适的时间片执行后续的协调

```ts
// 1. Update 对象
class Update {
  constructor(payload) {
    this.payload = payload; // 存放 setState 传入的状态对象或函数
    this.callback = null; // setState 的第二个回调参数
    this.next = null; // 指针，指向下一个 Update，形成链表
  }
}

// 2. UpdateQueue 对象（存储在类组件 Fiber 节点的 `updateQueue` 属性上）
class UpdateQueue {
  constructor() {
    this.shared = {
      pending: null, // 单向循环链表的尾部指针，存储所有待处理的 Update
    };
    this.firstBaseUpdate = null; // 用于并发中断时，记录尚未处理的基线更新
    this.lastBaseUpdate = null;
  }
}

// 3. Fiber 节点相关部分
class FiberNode {
  constructor(tag) {
    this.tag = tag; // 标记组件类型，如 ClassComponent, HostComponent
    this.updateQueue = null; // UpdateQueue 实例，类组件才有
    this.memoizedState = null; // 组件当前的状态，就是 Component 里面的所有 state
    this.alternate = null; // 指向 work-in-progress 或 current 树的对应节点
  }
}
```

### 重要概念：Fiber 上存放的数据不同

- **函数组件 Fiber**：`memoizedState` 指向 Hook 链表的头节点，用于保存所有 Hooks 的状态和顺序
- **类组件 Fiber**：`memoizedState` 直接存储组件实例的 state 对象（即 `this.state` 的值），它就是组件当前的状态快照，不是 null

```ts
// 类组件的 Fiber
const classComponentFiber = {
  tag: ClassComponent,
  stateNode: instance, // 指向组件实例
  memoizedState: { count: 0, text: 'hello' }, // 就是 this.state
  updateQueue: {
    /* UpdateQueue 对象，管理待处理的更新 */
  },
};

// 函数组件的 Fiber
const functionComponentFiber = {
  tag: FunctionComponent,
  stateNode: null,
  memoizedState: {
    // Hook 链表的头节点
    memoizedState: 0, // useState 的状态
    next: {
      // 下一个 Hook
      memoizedState: null, // useEffect 的依赖等
      next: null,
    },
  },
  updateQueue: null,
};
```

**总结**：在类组件的 `setState` 时，调用原型链上的方法创建一个 Update 对象，此时 Fiber 为类组件的数据结构，其余过程与函数组件 Hook 执行的流程类似。

---

## Prop 被动更新

被动更新是在协调（reconcile）过程中发现的 props 改变，与主动调用 `setState` 不同，这种更新不需要创建 Update 对象。

```jsx
// 父组件重新渲染，传了新的 props
<ChildComponent data={newData} />;
// ↓ React 在协调（reconcile）过程中发现
// 这个子组件需要更新，因为它的 props 变了
// ↓ React 调用
scheduleUpdateOnFiber(childFiber); // 直接调度，不创建 Update！
```

**关键点**：React 在协调子节点时，如果发现组件类型相同但 props 不同，就会直接标记这个 Fiber 需要更新，然后调度更新。

这里的 `scheduleUpdateOnFiber` 只是标记 Fiber 需要更新，和调度一个新的独立更新（如 setState）不一样，它不需要创建 Update 对象，而是直接在协调阶段被标记为需要更新。

---

## 挂载和卸载

### 挂载流程

挂载时执行若干初始化操作，并使用同步更新（SyncLane）确保立即渲染。

```jsx
// React 18
const root = ReactDOM.createRoot(container);
root.render(<App />); // 触发首次挂载
```

挂载过程分为两个主要步骤：

1. **初始化 Fiber 根节点和 WIP 树**：新建一个 Update 对象，触发同步更新

   ```ts
   // 1. 创建 Fiber 根节点和初始 workInProgress 树
   const uninitializedFiber = createFiber(HostRoot, null, null, 0);
   root.current = uninitializedFiber;

   // 2. 创建 Update 对象（与 setState 类似，但用于初始渲染）
   const update = {
     lane: SyncLane,
     payload: { element: <App /> }, // 传入 React 元素
     callback: null,
     next: null,
   };

   // 3. 调度更新
   enqueueUpdate(root.current, update);
   scheduleUpdateOnFiber(root, SyncLane); // 同更新流程入口
   ```

2. **初始化组件实例**：初始化 props 和 updater 属性，初始化状态，调用 `render` 获取子元素

   ```ts
   function mountClassComponent(workInProgress, ctor, newProps) {
     // 1. 创建组件实例
     const instance = new ctor(newProps);

     // 2. 初始化实例属性
     instance.props = newProps;
     instance.updater = classComponentUpdater;

     // 3. 初始化状态（处理 getDerivedStateFromProps）
     const getDerivedStateFromProps = ctor.getDerivedStateFromProps;
     if (typeof getDerivedStateFromProps === 'function') {
       const partialState = getDerivedStateFromProps(newProps, instance.state);
       if (partialState !== null) {
         instance.state = Object.assign({}, instance.state, partialState);
       }
     }

     // 4. 调用遗留生命周期（如 UNSAFE_componentWillMount）
     if (typeof instance.componentWillMount === 'function') {
       instance.componentWillMount();
     }

     // 5. 调用 render，获取子元素
     const nextChildren = instance.render();

     // 6. 协调子节点
     reconcileChildren(workInProgress, nextChildren);

     // 7. 保存状态和实例引用
     workInProgress.memoizedState = instance.state;
     workInProgress.stateNode = instance; // 关联实例
   }
   ```

### 卸载流程

卸载由父组件重新渲染导致子组件被移除时发生，不需要调用 `scheduleUpdateOnFiber`，而是直接标记节点为删除。

```jsx
// 父组件从渲染 <Child /> 变成不渲染
class Parent extends React.Component {
  state = { showChild: true };

  render() {
    return this.state.showChild ? <Child /> : null;
    // 当 showChild 变为 false 时，Child 卸载
  }
}
```

卸载过程在协调阶段完成：

```ts
// 在协调阶段，React 发现子组件需要被删除
function reconcileChildFibers(returnFiber, currentFirstChild, newChild) {
  if (currentFirstChild !== null && newChild === null) {
    // 标记子节点为删除
    deleteChild(returnFiber, currentFirstChild);
    return null;
  }
}

function deleteChild(returnFiber, childToDelete) {
  // 1. 标记删除效果
  childToDelete.flags = Deletion;

  // 2. 将待删除的 Fiber 添加到父 Fiber 的 deletions 列表
  if (returnFiber.deletions === null) {
    returnFiber.deletions = [childToDelete];
  } else {
    returnFiber.deletions.push(childToDelete);
  }
}
```

**为什么不需要走调度？** 卸载也是协调发生的副作用，而不是独立触发的更新：

```ts
// 实际流程
父组件 setState → scheduleUpdateOnFiber(父组件)
  → 协调父组件
  → 发现子组件需要删除
  → 标记子组件为删除
  → 提交阶段执行删除和卸载生命周期（componentWillUnmount）
```

---

## Context 订阅更新

类组件在实例化时通过 `contextType` 或者 `Consumer` 静态订阅，只要 `contextType` 对应的 Context 变化，整个组件必然更新。

```jsx
// 订阅方式
class MyClass extends React.Component {
  static contextType = MyContext; // 静态绑定

  render() {
    return this.context.value; // 实例获取
  }
}

// Provider 更新时
<MyContext.Provider value={newValue}>
  <MyClass />
</MyContext.Provider>

// React 内部遍历所有消费者
consumers.forEach((consumerFiber) => {
  consumerFiber.lanes = Update; // 标记更新
  scheduleUpdateOnFiber(consumerFiber);
});
```

**注意事项**：由于 `contextType` 只能绑定一个 Context，要实现多个上下文的使用，需要使用 HOC 对 context 进行组合，或者使用 `Consumer` 嵌套。

**更新机制**：

1. Provider 的 value 变化时，React 会标记所有消费该 context 的组件需要更新
2. 不会为每个消费组件创建独立的 Update 对象
3. 直接调度：找到所有受影响的组件，为每个消费组件的 Fiber 标记更新，然后调用 `scheduleUpdateOnFiber`（从最近的公共祖先开始）

### Provider 如何查找公共祖先

Context 的结构里面包含生产者和消费者：

```ts
const context = {
  _currentValue: any, // 当前值
  Provider: { type: Provider }, // Provider 组件
  Consumer: { type: Context }, // Consumer 组件
};
```

React 内部维护了一个栈来记录 Provider Fiber：

```ts
// 渲染时入栈
beginWork(ProviderFiber) {
  pushProvider(providerFiber, context);
  // 渲染子组件
  renderSubtree();
  // 完成时出栈
  popProvider(context);
}
```

消费 Context 时，React 会向上遍历找到最近的 Provider 作为祖先：

```ts
// 从当前组件向上查找最近的 Provider
function readContext(context) {
  // 1. 获取当前组件 Fiber
  const currentlyRenderingFiber = getCurrentFiber();

  // 2. 向上遍历父链
  let parentFiber = currentlyRenderingFiber.return;
  while (parentFiber !== null) {
    // 3. 检查是否是目标 Provider
    if (parentFiber.type === context.Provider) {
      return parentFiber.pendingProps.value; // 找到最近 Provider
    }
    parentFiber = parentFiber.return; // 继续向上
  }

  return context._currentValue; // 返回默认值
}
```

### 依赖收集和更新传播

更新时，Provider Fiber 不直接记录消费者，而通过共同的 Context 对象实现依赖收集：

1. **消费时**：在 Fiber 的 `dependencies` 记录了所有消费了的 Context 链条
2. **更新时**：通过 Provider Fiber 作为根，往下遍历找 Fiber 的 `dependencies` 中有该 Context 的节点，标记更新即可

```ts
// React 内部：消费时记录依赖
function readContext(context) {
  const currentlyRenderingFiber = getCurrentlyRenderingFiber();

  // 1. 将当前 Fiber 标记为依赖此 Context
  const dependency = {
    context: context,
    memoizedValue: context._currentValue,
  };

  // 2. 将此依赖添加到当前 Fiber 的 dependencies 链表
  currentlyRenderingFiber.dependencies = {
    lanes: NoLanes,
    firstContext: dependency,
  };
  // ...
}

// Provider 更新时
function updateContextProvider(current, workInProgress, renderLanes) {
  const newValue = workInProgress.pendingProps.value;
  const oldValue = current !== null ? current.memoizedProps.value : context._currentValue;

  if (oldValue !== newValue) {
    // 标记所有消费此 context 的组件需要更新
    propagateContextChange(workInProgress, context, renderLanes);
  }
}

// 从当前 Provider 节点开始，深度优先遍历子树
function propagateContextChange(sourceFiber, context, renderLanes) {
  let node = sourceFiber.child;
  while (node !== null) {
    // 检查每个 Fiber 是否依赖此 Context
    if (node.dependencies !== null) {
      const dependencies = node.dependencies;
      let dependency = dependencies.firstContext;

      // 遍历此 Fiber 的所有 Context 依赖
      while (dependency !== null) {
        if (dependency.context === context) {
          // 标记此 Fiber 需要更新
          scheduleUpdateOnFiber(node, renderLanes);
          break; // 找到就跳出
        }
        dependency = dependency.next;
      }
    }

    // 继续遍历子节点和兄弟节点（深度优先）
    if (node.child !== null) {
      node = node.child;
    } else {
      while (node !== sourceFiber && node.sibling === null) {
        node = node.return;
      }
      node = node.sibling;
    }
  }
}
```

**总结**：Context 更新机制通过依赖收集避免了全局遍历，只更新真正消费该 Context 的组件，提高了性能。

---

## 总结

React Class Component 的更新机制主要有以下几种触发方式：

1. **setState 主动更新**：创建 Update 对象，加入 updateQueue，通过调度系统更新
2. **Props 被动更新**：在协调阶段发现 props 变化，直接标记更新，无需创建 Update 对象
3. **挂载更新**：首次渲染时创建 Update 对象，使用同步更新（SyncLane）
4. **卸载**：在协调阶段标记删除，作为副作用处理，无需调度
5. **Context 订阅更新**：通过依赖收集机制，Provider 变化时标记所有消费者更新

**核心区别**：
- **需要创建 Update 对象**：setState、挂载
- **不需要创建 Update 对象**：Props 被动更新、Context 更新、卸载

所有更新最终都会通过 `scheduleUpdateOnFiber` 进入调度系统，但不同场景下的处理方式不同，React 通过这种机制实现了高效的更新优化。
