---
title: 'Webpack HMR 更新原理解析'
date: 2025-08-29 14:30:00 +0800
tags: 前端 精选
subtitle: '以 React 更新为例'
---

# Webpack HMR 更新原理解析

## 概念

**HMR 即 hot module replacement ，模块热更新。一句话原理解释就是：**

1. 开发服务器监测到文件变更后，只把变化了的模块编译成增量补丁发给浏览器；
2. 浏览器的「HMR 运行时」通过 `module.hot` 方法将旧模块替换成新模块；
3. 更新完执行/卸载回调，回调由用户手动编写或通过常见的插件添加；
4. 通过回调中的代码让页面更新。
<br />
**各个流程简要分析**

1. **文件变更导致的编译增量 bundle。** webpack-dev-server 监测到文件变更，仅构建受影响的模块，并通过 web-socket 推送更新信息给浏览器

2. **浏览器加载更新包。** 更新信息包含哪些模块更新，以及如何拉去更新包的元信息，HMR 运行时通过代码请求下载并更新模块

3. **替换模块并执行回调。** 检查模块或者父级模块是否使用了 `module.hot.accept(...)` ，运行时会执行该回调，回调里通常包含 re-require/render 等方法；如果没有使用处理回调，运行时直接触发整个页面的更新

4. **样式的更新链路。**`style-loader` 会把 css 直接注入到 style 标签中，更新时也会直接替换当前的内容，浏览器自动应用新样式，无需 JS 挂载



## React 如何在 HMR 自动执行新代码

因为在入口文件中的某一个位置存在代码为 `module.hot.accept('./App',()=>{ ... re-render ...})` 注册了更新的回调函数。

常见的插件如 `react-refresh` 或者 `react-hot-loader` 更新还能尽量保留组件本地的 state ，不需要整条链路卸载重新挂载。



### 手动实现一下 `react-refresh` 插件

**原理要点：**

- webpack-dev-server 下发的是增量模块，浏览器中的 HMR 运行时会把新模块下载并替换旧模块（内部是替换 module map）

- `module.hot.accept(modulePath, callback)` 建立 HMR 运行时和应用代码的联系，也是自动执行新代码的来源

- 还有提供 `module.hot.dispose` 以及 `module.hot.data` 可以做到保留某些更新前的 state，在新模块中用 data 恢复

**代码示例：**

```js
// src/index.jsx
import App from './App';
const container = document.getElementById('root');
const root = createRoot(container);

function render(Component) {
  root.render(<Component />);
}

render(App);

// 手动 HMR 接受 App 更新（webpack 提供 module.hot）
if (module.hot) {
  module.hot.accept('./App', () => {
    // 这里使用 require 获取最新的模块实现（CommonJS），注意 webpack 会把 ES 模块打包成可兼容的形式
    const NextApp = require('./App').default;
    render(NextApp);
  });
}

```

```js
// src/App.jsx
import React, { useState, useEffect } from 'react';

/**
 * 演示如何在纯手动 HMR 下手动保留组件 state：
 * - 在 effect 里注册 module.hot.dispose，把当前 state 存到 data 上
 * - 初始化时从 module.hot.data 读取（若存在）
 */
export default function App() {
  // 若上一个 module 在 dispose 时保存了数据，会挂到 module.hot.data
  const prev = (module.hot && module.hot.data && module.hot.data.saved) || {};
  const [count, setCount] = useState(prev.count || 0);

  useEffect(() => {
    if (module.hot) {
      // 在模块替换之前运行，把要保留的数据写入 data
      module.hot.dispose((data) => {
        data.saved = { count };
      });
    }
  }, [count]);

  return (
    <div style={{ padding: 20 }}>
      <p>修改这个文件并保存，HMR 会替换模块并触发 accept 回调。</p>
    </div>
  );
}

```

**为什么 React 会“执行”新代码？**

* 当 `App.jsx` 文件被改并重新编译，dev-server 下发更新，webpack 的模块系统用新模块定义覆盖旧的模块表项。

* 因为我们在 `index.js` 注册了 `module.hot.accept('./App', ...)`，所以 HMR 运行时会调用回调，回调里 `require('./App')` 拿到的是**新模块实现**，然后我们把新组件传给 `root.render()`：这样页面用的是新实现，从而“自动执行新代码”。

**如何保留 state（手动）？**

* `module.hot.dispose` 在替换发生前执行，把需要保留的数据写进 `data`。新模块加载后可以读 `module.hot.data` 恢复。上面 `App.jsx` 就示范了计数器的保留方法。

* 这种保留是手工的、粗粒度的：你需要自己挑哪些 state 存储；并且对复杂的组件树（hooks 列表、上下文、闭包）不容易做到完全一致。



### why react-refresh

**为什么用 react-refresh？**

* 它比手动 HMR 更智能：在大多数组件变更下能**保留 hooks 状态**并替换实现，做到“热替换而不重置 state”。

* 原理：react-refresh 在 Babel 阶段给每个组件打上标记并把模块暴露一个“签名”；运行时维护旧组件实例与新实现的映射，尝试把旧的 hooks/state 迁移到新的实现（匹配 hooks 顺序/数量），并对不安全的更改回退到完全刷新。它避免了你手工保存/恢复 state 的繁琐。

**要做的代码级改动**

1. 在 Babel 配置里加 `react-refresh/babel` 插件（仅 dev）。

2. 插件会在编译后生成一些运行时代码（层面上是注入标识和注册函数）。

3. 在 webpack dev 环境中加入 `@pmmmwh/react-refresh-webpack-plugin`，它会注入 client runtime 支持、在模块热替换时调用 react-refresh 的 runtime。

4. 代码上你不需要写 `module.hot.accept`（插件会自动处理大多数模块边界），但仍可以在**特殊场景用手动 accept**。

**代码层面简要说明**

* Babel 插件会在每个导出的 React 组件附近插入注册逻辑，类似伪代码：
    ```js
    // 伪代码：Babel 插件为每个组件注入注册
    const _component = function MyComp(){ /* ... */ }
    if (module && module.hot) {
      // 向 react-refresh runtime 注册组件实现与 id
      registerRefreshComponent(_component, 'MyComp#moduleId');
    }
    export default _component;
    ```

* 当模块更新后，react-refresh runtime 拿到新实现，检查旧实现的“签名”（hook 使用形态），若能兼容就把旧实例的 state 挪给新实现，并触发局部重渲染；若不兼容则退回整页刷新。

**何时回退（fallback）？**

* 组件类型发生了**不兼容的结构性变化**（比如从函数组件变成 class，或改变 hook 顺序），runtime 会判断不可迁移并触发全页面刷新。



## CSS 样式的自动更新

**核心点**

* `style-loader`把 CSS 当模块处理：加载时创建 `<style>` 标签并把编译后的 CSS 插入其中。

* 当对应的 CSS 模块被更新，`style-loader` 的 HMR 逻辑会替换/更新对应的 `<style>` 标签的内容，因此样式即时生效。

* CSS 更新是最简单的 HMR：不需要调用如 React render 之类的回调——浏览器的样式表更新立即影响渲染。

**直观理解**

* JS 模块更新需要重新执行组件代码并调用 React 的渲染；CSS 模块更新只是替换文本内容，浏览器自行重新计算样式并渲染。



## HMR 运行时的替换逻辑揭秘

* **moduleMap** (`__webpack_modules__`) 是 Webpack 运行时保存所有模块工厂函数的对象。

* HMR 的原理就是：**用新工厂函数替换 moduleMap 的旧函数，并重新执行依赖链，得到一个 exports**。

### 1. Webpack HMR 的运行时核心

在打包后的产物里，Webpack 会构造一个运行时（runtime），它维护了一个「模块系统」，大概类似下面这样（精简版）：

```js
// 伪代码
var __webpack_modules__ = {
  "./src/index.js": function(module, exports, __webpack_require__) {
    // 具体的模块代码
  },
  "./src/App.js": function(module, exports, __webpack_require__) {
    // 具体的模块代码
  }
};

var __webpack_module_cache__ = {}; // 已加载模块的缓存

function __webpack_require__(moduleId) {
  if (__webpack_module_cache__[moduleId]) {
    return __webpack_module_cache__[moduleId].exports;
  }
  var module = (__webpack_module_cache__[moduleId] = {
    exports: {}
  });
  __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
  return module.exports;
}
```

这里：

* `__webpack_modules__` 就是所谓的 **moduleMap**，本质是一个对象：**key 是 moduleId，value 是工厂函数**。
* `__webpack_require__` 负责执行工厂函数，把 `exports` 返回。



### 2. HMR 的更新逻辑

当某个文件改动后（例如 `App.js`），webpack-dev-server 会：

1. 重新编译变动过的模块，生成新的 `App.js` 工厂函数。
2. 通过 websocket 通知浏览器。
3. 浏览器端 HMR runtime 收到更新后，**替换掉 `__webpack_modules__` 里的对应模块函数**。

大概伪代码：

```js
// 收到新的模块代码
function hotUpdate(newModules) {
  for (var moduleId in newModules) {
    // 替换掉 moduleMap 里旧的模块工厂
    __webpack_modules__[moduleId] = newModules[moduleId];
  }

  // 找到依赖此模块的上层模块，重新执行
  applyUpdate(moduleId);
}

function applyUpdate(moduleId) {
  var oldModule = __webpack_module_cache__[moduleId];
  if (oldModule) {
    // 让旧模块失效
    delete __webpack_module_cache__[moduleId];
  }

  // 重新 require，就会调用新的工厂函数
  __webpack_require__(moduleId);
}
```

这样一来：

* **JS 模块更新时，就会触发上层重新执行，从而“生效”。**

  ```js
  module.hot.accept('./App', () => {
      // 这里使用 require 获取最新的模块实现，即上述提及的已经重新更新了的模块 exports
      const NextApp = require('./App').default;
      render(NextApp);
  });
  ```

* CSS loader 的特殊点在于，它不缓存样式，**而是直接替换 `<style>` 标签里的内容，所以能立即刷新页面样式**。
