---
title: React 扩展机制
subtitle: Portals、Profiler 与 Error Boundaries
date: 2025-12-29 12:00:00 +0800
tags: 前端 源码
remark: 'React 扩展机制，包括 Portal 如何跨 DOM 位置渲染组件、Profiler 如何测量渲染性能、Error Boundary 捕获子树错误机制'
---

# React 扩展机制

> React 提供了多种扩展机制，用于处理特殊场景：Portal 用于跨 DOM 树渲染，Profiler 用于性能测量，Error Boundary 用于错误捕获。
>
> 这些机制在源码中都有特定的生命周期和实现方式，理解它们有助于更好地使用 React 和排查问题。

## Portal：跨 DOM 位置渲染

Portal 允许将子节点渲染到 DOM 树的不同位置，常用于模态框、工具提示等场景。

### 基本用法

```tsx
import { createPortal } from 'react-dom';

function Modal({ children, isOpen }) {
  if (!isOpen) return null;
  
  return createPortal(
    <div className="modal">
      {children}
    </div>,
    document.body  // 渲染到 body，而不是父组件的位置
  );
}

function App() {
  return (
    <div>
      <Modal isOpen={true}>
        <h1>Modal Content</h1>
      </Modal>
    </div>
  );
}
```

**DOM 结构**：

```html
<!-- React 树结构 -->
<div id="app">
  <div>
    <!-- Modal 组件在这里 -->
  </div>
</div>

<!-- 实际 DOM 结构 -->
<div id="app">
  <div></div>
</div>
<body>
  <div class="modal">
    <h1>Modal Content</h1>
  </div>
</body>
```

### 实现原理

```ts
function createPortal(
  children: ReactNode,
  container: DOMContainer,
  key?: string | null
): ReactPortal {
  return {
    $$typeof: REACT_PORTAL_TYPE,
    key: key == null ? null : String(key),
    children,
    containerInfo: container,
    implementation: null,
  };
}
```

**渲染过程**：

```ts
function commitPlacement(finishedWork: Fiber): void {
  const parentFiber = getHostParentFiber(finishedWork);
  
  let parent;
  let isContainer;
  
  const parentStateNode = parentFiber.stateNode;
  
  switch (parentFiber.tag) {
    case HostComponent:
      parent = parentStateNode;
      isContainer = false;
      break;
    case HostRoot:
      parent = parentStateNode.containerInfo;
      isContainer = true;
      break;
    case HostPortal:
      // Portal 的父节点是另一个 Portal 的容器
      parent = parentStateNode.containerInfo;
      isContainer = true;
      break;
    default:
      throw new Error('Invalid host parent fiber.');
  }
  
  if (finishedWork.flags & Placement) {
    const before = getHostSibling(finishedWork);
    insertOrAppendPlacementNode(finishedWork, before, parent);
  }
}
```

**Portal 的特殊处理**：

```ts
function getHostParentFiber(fiber: Fiber): Fiber {
  let parent = fiber.return;
  
  while (parent !== null) {
    if (isHostParent(parent)) {
      return parent;
    }
    parent = parent.return;
  }
  
  throw new Error('Expected to find a host parent.');
}

function isHostParent(fiber: Fiber): boolean {
  return (
    fiber.tag === HostComponent ||
    fiber.tag === HostRoot ||
    fiber.tag === HostPortal  // Portal 也是有效的父节点
  );
}
```

### 事件冒泡

Portal 中的事件会**冒泡到 React 树**，而不是 DOM 树：

```tsx
function App() {
  function handleClick() {
    console.log('App clicked');  // 会触发
  }
  
  return (
    <div onClick={handleClick}>
      <Modal>
        <button>Click me</button>
      </Modal>
    </div>
  );
}
```

**实现原理**：React 使用事件委托，所有事件都委托到根容器，因此 Portal 中的事件也会冒泡到 React 树。

### 使用场景

| 场景 | 推荐 | 原因 |
|------|------|------|
| **模态框** | ✅ Portal | 避免 z-index 问题 |
| **工具提示** | ✅ Portal | 避免 overflow 裁剪 |
| **下拉菜单** | ✅ Portal | 避免父容器限制 |
| **普通组件** | ❌ Portal | 增加复杂度 |

## Profiler：性能测量

Profiler 用于测量 React 组件的渲染性能，帮助识别性能瓶颈。

### 基本用法

```tsx
import { Profiler } from 'react';

function onRenderCallback(
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime
) {
  console.log('Profiler:', {
    id,
    phase,  // 'mount' 或 'update'
    actualDuration,  // 实际渲染时间
    baseDuration,  // 估计渲染时间（无 memo）
    startTime,  // 开始时间
    commitTime,  // 提交时间
  });
}

function App() {
  return (
    <Profiler id="App" onRender={onRenderCallback}>
      <ExpensiveComponent />
    </Profiler>
  );
}
```

### 实现原理

```ts
function updateProfiler(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes
): Fiber | null {
  const nextProps = workInProgress.pendingProps;
  const onRender = nextProps.onRender;
  
  if (onRender !== null && typeof onRender === 'function') {
    // 记录开始时间
    workInProgress.memoizedProps = {
      ...nextProps,
      onRender,
    };
  } else {
    // 开发环境警告
    if (__DEV__) {
      console.warn('Profiler onRender prop is not a function.');
    }
  }
  
  // 处理子节点
  reconcileChildren(current, workInProgress, nextProps.children, renderLanes);
  return workInProgress.child;
}
```

**性能测量**：

```ts
function commitProfilerEffect(finishedWork: Fiber): void {
  const { onRender, id } = finishedWork.memoizedProps;
  
  if (typeof onRender === 'function') {
    const { effectDuration } = finishedWork;
    const { actualDuration, baseDuration, treeBaseDuration } = effectDuration;
    
    // 调用回调
    onRender(
      id,
      finishedWork.mode & ProfileMode ? 'mount' : 'update',
      actualDuration,
      baseDuration,
      finishedWork.actualStartTime,
      getCommitTime()
    );
  }
}
```

### 性能数据解读

```tsx
function onRenderCallback(
  id,
  phase,
  actualDuration,  // 实际渲染时间（包括子组件）
  baseDuration,     // 估计渲染时间（不包括 memo 优化）
  startTime,
  commitTime
) {
  // actualDuration > baseDuration：可能有性能问题
  // actualDuration < baseDuration：使用了 memo 优化
}
```

**优化建议**：

| 情况 | 可能原因 | 优化方案 |
|------|---------|---------|
| `actualDuration` 很大 | 组件渲染慢 | 使用 `React.memo`、`useMemo` |
| `baseDuration` 很大 | 组件本身复杂 | 拆分组件、优化算法 |
| `actualDuration >> baseDuration` | 子组件重复渲染 | 使用 `React.memo`、`useMemo` |

### 使用场景

```tsx
// 场景 1：测量特定组件
<Profiler id="ExpensiveComponent" onRender={onRenderCallback}>
  <ExpensiveComponent />
</Profiler>

// 场景 2：测量整个应用
<Profiler id="App" onRender={onRenderCallback}>
  <App />
</Profiler>

// 场景 3：嵌套测量
<Profiler id="App" onRender={onRenderCallback}>
  <Profiler id="Header" onRender={onRenderCallback}>
    <Header />
  </Profiler>
  <Profiler id="Content" onRender={onRenderCallback}>
    <Content />
  </Profiler>
</Profiler>
```

## Error Boundary：错误边界

Error Boundary 用于捕获子组件树中的错误，防止整个应用崩溃。

### 基本用法

```tsx
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    // 更新 state，显示错误 UI
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    // 记录错误信息
    console.error('Error caught:', error, errorInfo);
    logErrorToService(error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <BuggyComponent />
    </ErrorBoundary>
  );
}
```

### 实现原理

**错误捕获**：

```ts
function commitRoot(root: FiberRoot, finishedWork: Fiber) {
  // 在 Commit Phase 捕获错误
  commitBeforeMutationEffects(root, finishedWork);
  commitMutationEffects(root, finishedWork, committedLanes);
  commitLayoutEffects(finishedWork, root, committedLanes);
  
  // 检查是否有错误
  if (root.capturedErrors !== null) {
    const errors = root.capturedErrors;
    root.capturedErrors = null;
    
    // 处理错误
    commitErrorHandling(root, errors);
  }
}
```

**错误处理**：

```ts
function commitErrorHandling(root: FiberRoot, errors: Array<CapturedValue>) {
  for (let i = 0; i < errors.length; i++) {
    const error = errors[i];
    const errorBoundary = findErrorBoundary(root.current, error);
    
    if (errorBoundary !== null) {
      // 找到错误边界，调用生命周期
      const errorInfo = {
        componentStack: getComponentStack(errorBoundary),
      };
      
      if (errorBoundary.tag === ClassComponent) {
        const instance = errorBoundary.stateNode;
        instance.componentDidCatch(error, errorInfo);
        
        // 更新状态
        const newState = getDerivedStateFromError(errorBoundary, error);
        if (newState !== null) {
          updateClassComponent(
            errorBoundary,
            errorBoundary.elementType,
            errorBoundary.memoizedProps,
            newState
          );
        }
      }
    } else {
      // 没有错误边界，应用崩溃
      throw error;
    }
  }
}
```

**查找错误边界**：

```ts
function findErrorBoundary(fiber: Fiber, error: any): Fiber | null {
  let node = fiber;
  
  while (node !== null) {
    if (node.tag === ClassComponent) {
      const ctor = node.type;
      const instance = node.stateNode;
      
      // 检查是否有 componentDidCatch 或 getDerivedStateFromError
      if (
        typeof ctor.getDerivedStateFromError === 'function' ||
        (instance !== null &&
         typeof instance.componentDidCatch === 'function' &&
         !isAlreadyFailedLegacyErrorBoundary(instance))
      ) {
        return node;  // 找到错误边界
      }
    }
    
    node = node.return;
  }
  
  return null;  // 没有找到错误边界
}
```

### 错误边界限制

Error Boundary **不能捕获**以下错误：

| 错误类型 | 是否捕获 | 原因 |
|---------|---------|------|
| **渲染错误** | ✅ | 主要用途 |
| **事件处理器错误** | ❌ | 在事件处理中，不在渲染中 |
| **异步代码错误** | ❌ | setTimeout、Promise 等 |
| **服务端渲染错误** | ❌ | SSR 不支持 |
| **错误边界自身错误** | ❌ | 会向上传播 |

```tsx
function BuggyComponent() {
  // ✅ 会被捕获
  if (Math.random() > 0.5) {
    throw new Error('Render error');
  }
  
  // ❌ 不会被捕获
  function handleClick() {
    throw new Error('Event error');
  }
  
  // ❌ 不会被捕获
  useEffect(() => {
    throw new Error('Effect error');
  }, []);
  
  return <button onClick={handleClick}>Click</button>;
}
```

### 函数组件错误边界

函数组件不能直接作为错误边界，需要使用类组件或第三方库：

```tsx
// ❌ 函数组件不能作为错误边界
function ErrorBoundary({ children }) {
  // 无法使用 getDerivedStateFromError 和 componentDidCatch
  return children;
}

// ✅ 使用类组件
class ErrorBoundary extends React.Component {
  // ...
}

// ✅ 使用第三方库（如 react-error-boundary）
import { ErrorBoundary } from 'react-error-boundary';

function App() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <BuggyComponent />
    </ErrorBoundary>
  );
}
```

### 使用场景

```tsx
// 场景 1：全局错误边界
function App() {
  return (
    <ErrorBoundary fallback={<AppErrorFallback />}>
      <Router>
        <Routes />
      </Router>
    </ErrorBoundary>
  );
}

// 场景 2：局部错误边界
function Dashboard() {
  return (
    <div>
      <ErrorBoundary fallback={<WidgetErrorFallback />}>
        <Widget1 />
      </ErrorBoundary>
      <ErrorBoundary fallback={<WidgetErrorFallback />}>
        <Widget2 />
      </ErrorBoundary>
    </div>
  );
}

// 场景 3：嵌套错误边界
function App() {
  return (
    <ErrorBoundary fallback={<AppErrorFallback />}>
      <Header />
      <ErrorBoundary fallback={<ContentErrorFallback />}>
        <Content />
      </ErrorBoundary>
      <Footer />
    </ErrorBoundary>
  );
}
```

## 总结

React 的扩展机制提供了强大的能力：

1. **Portal**：跨 DOM 位置渲染，解决 z-index、overflow 等问题
2. **Profiler**：性能测量，帮助识别和优化性能瓶颈
3. **Error Boundary**：错误捕获，提高应用的健壮性

这些机制在源码中都有特定的实现方式，理解它们有助于：
- 更好地使用 React 特性
- 排查和解决问题
- 优化应用性能
- 提高应用稳定性

通过合理使用这些机制，可以构建更强大、更稳定的 React 应用。

