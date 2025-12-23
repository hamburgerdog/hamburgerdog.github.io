---
title: React Suspense
subtitle: JND 优化
date: 2025-12-23 13:00:00 +0800
tags: 前端 源码
remark: 'React Suspense，主要介绍 JND 优化，以及 RootSuspended 和 RootSuspendedWithDelay 的差异'
---

# React Suspense 

## JND 优化

JND（Just Noticeable Difference）如果有用过 `spin` 组件就能理解闪烁这个概念，即在数据快速更新的时候，反复切换 loading 状态反而用户的体验不好。

**闪烁问题**

场景：请求数据->立即触发 loading->实时获取数据->隐藏loading，此时页面会闪烁一个loading。

**JND 是一个阶梯式的更新策略**

主要利用人对短时间差异不敏感的特点，在数据可能很快到达时，延迟显示 loading，避免闪烁。通过阶梯式阈值，等待越久，可容忍的额外等待时间越长。以下是使用 JND 优化后的场景：

```ts
function jnd(timeElapsed) {
  return timeElapsed < 120
    ? 120
    : timeElapsed < 480
    ? 480
    : timeElapsed < 1080
    ? 1080
    : timeElapsed < 1920
    ? 1920
    : timeElapsed < 3000
    ? 3000
    : timeElapsed < 4320
    ? 4320
    : ceil(timeElapsed / 1960) * 1960;
}
```

场景一：用户点击，50ms 后数据未到，先继续等待 70ms，如果 70ms 内已经等到，则直接展示数据。

场景二：已等待 500ms，继续等待 580ms。

**心理学依据**

* 短时间差异（< 120ms）通常感知不到

* 等待越久，对额外等待的容忍度越高

* 避免不必要的 loading 闪烁，提升体验

**权衡**

* 优点：减少闪烁，体验更平滑

* 缺点：可能延迟显示 loading，极端情况下用户等待更久

**为什么会有多个阈值呢？而不是统一命中底第一个 case**

`timeElapsed` 表示用户已经为当前调度任务等待的真实时间，它由 Scheduler 在任务创建时记录并持续累积，用于通过 JND 模型动态决定调度超时与反馈时机，而非衡量 Promise 或 render 本身的耗时。

```js
const now = ()=>performance.now();
task.startTime = now();
//	在后续的调度判断中
timeElapsed = now() - task.startTime;
```

`timeElapsed` = 用户从"发起这个更新"到"现在还没看到结果"的时间，这是一个**用户感知时间**，不是技术耗时，再结合心理学的认识，「等待越久，对额外等待的容忍度越高」，所以才会在 JND 函数中等待更多的时间。

## `RootSuspended` 和 `RootSuspendedWithDelay` 的差异

**`RootSuspended` 的核心概念**

Suspense 内部抛出了 Promise，且 **React 认为当下已经可以展示 fallback**：

1. 已经超过了 suspense delay 时间
2. 这是一个非过渡的更新，不使用 `transition`
3. 用户主动触发的更新，需要立即反馈

因此，这次 render 会被中断，Root 标记为 `RootSuspended`，首次渲染会提交 fallback，或者等待 resolve 后重新调度 render。

**`RootSuspendedWithDelay` 的核心概念**

给 fallback 一段时间，等待这段时间后，再渲染 fallback：

1. 必须是并发渲染的模式下
2. 更新是过渡的，即 `startTransition`
   - 输入框 onChange 是普通更新，不触发
   - 点击按钮 setState 是普通更新
   - 非 transition 的路由跳转也是普通更新
3. Suspense 必须抛出 Promise
4. 没有必要立刻展示 fallback 的场景

因此，先保留旧 UI，监听 promise resolve 或者等待 delay 时间，如果在等待期已经收到了 promise resolve，那就直接渲染无需 fallback 了。

**非必须立即展示的含义**

如果不更新，屏幕上是否有一个可接受的旧 UI：

- 不能 delay 的场景：首屏渲染、当前组件已经在 loading 里面，已经没有可回退的画面了（实验性的 API 用于嵌套）

- 可以考虑 delay 的场景：Tab 切换、页面内部模块切换、搜索条件变化，都使用了 `transition`

在 delay 场景下，再会考虑 JND 优化，即本来已经等待了这些时间了，就再等一会再展示 fallback 了。

```
T = 0ms
用户触发 transition 更新

T = 5ms
Suspense 抛 Promise
→ RootSuspendedWithDelay
→ 保留旧 UI

T = 80ms
Promise resolve
→ 直接恢复 render
→ 无 fallback
→ 用户无感

-------------------------

另一个分支：

T = 0ms
transition 更新

T = 5ms
RootSuspendedWithDelay

T = 200ms
Promise 仍未 resolve
→ 超过 JND 安全区
→ 升级为 RootSuspended

T = 210ms
fallback commit
→ 用户感知 loading（但合理）
```

