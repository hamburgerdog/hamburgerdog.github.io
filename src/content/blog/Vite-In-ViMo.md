---
title: 'Vite in ViMo'
date: 2023-07-01 23:00:00 +0800
tags: 前端 精选
---

# Vite3 in ViMo

> Vite 是法语发音中「轻快、迅捷」的意思，就如它的名字一般，体验感就是一个字：快

## 📝 首先

这篇文档分享的内容是，「我如何为 ViMo 的开发模式引入 `vite` 并兼容当前项目脚手架」。引入的整体过程并不复杂，**核心部分在于引入** `Vite` **后如何为其增效**，以适合 ViMo 这一工程。

<br />

**问题背景**

ViMo 项目工程是最初基于 cra 这类脚手架搭建的，并将其内部配置解构了出来，这样导致整个 `webpack` 配置特别繁重，很难细究调整，随着迭代进行，工程项目日益庞大，通过编译打包到开发环境的过程变得繁重缓慢。

**解决方式**

1. `webpack5 + msfu` ，问题点在于，目前 ViMo 的 `webpack` 配置属实有一点点繁重， `webpack5` 并不是渐进式改动的，要整体搬迁到是存在一定难度的，这种做法比较适合作为长期解决方案。

2. 基于 `ES Module` 以 `Vite` 为例，这是于 `webpack` 思路不同的一种方案，利用的是浏览器的自身能力，简单理解就是“动态引入”，把当前需要的资源扔给浏览器自己解析，当然也可以理解为「“翻”译打包」分片式进行 QAQ。

_PS: 当前仅聚焦「开发模式」不关注「生产模式」，引入_ `Vite` _也仅在「开发模式」中使用，依旧建议同步使用_ `webpack` _进行项目开发_

<br />

## 🔧 引入

### 🧾 常见配置

可以通过 `create-vite` 来初始化项目 `npm init vite-app your-react --template`

以下为 ViMo 项目中 `Vite` 的简洁配置分享，简单浏览一下即可知具体开放的功能：

```javascript
//  react 项目常用配置及插件推荐
import { defineConfig } from 'vite';
import reactRefresh from '@vitejs/plugin-react-refresh'; //  babel 插件实现 hook 热更新
import mkcert from 'vite-plugin-mkcert'; //  伪造本地证书以开启 https 模式
import proxy from 'vite-plugin-http2-proxy'; //  反向代理同时兼容 http2
import vitePluginImp from 'vite-plugin-imp'; //  管理 Vite 引入包的方式/方便动态引入
import svgr from 'vite-plugin-svgr'; //  支持 svgr
import path from 'path';

export default defineConfig({
  plugins: [
    reactRefresh(),
    svgr(),
    mkcert(),
    //  反向代理的配置
    proxy({
      '/api': {
        target: 'http://xxx.xx.xx.cn', // 新开发环境
      },
    }),
    //  动态引入的配置
    vitePluginImp({
      libList: [
        {
          libName: 'antd', //  引入包名
          style: (name) => {
            if (name === 'a' || name === 'b') {
              return `antd/lib/a/style/index.css`;
            }
            //  ....
            return `antd/lib/${name}/style/index.css`;
          },
        },
      ],
    }),
  ],
  //  支持 less/js 编译，vite 原生已集成了相关插件
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
      },
    },
  },
  //  制定静态资源目录，请与 index.html 文件分开
  publicDir: './public',
  //  服务器的根目录，在此目录下自动寻找 index.html
  base: './',
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
    //  文件路径别名的配置，VSCode 记得配置一下 jsconfig.json 并安装 auto-import 插件，为引用赋能
    alias: [
      { find: '@/', replacement: '/src/' }, //  这里时通过 baseURL 进行自动转化的
      { find: /* ~/ */ /^~(?=\/)/, replacement: path.join(__dirname, 'node_modules') },
      { find: /* ~ */ /^~(?!\/)/, replacement: path.join(__dirname, 'node_modules/') },
    ],
  },
  //  自定义预编译后的依赖缓存，首次加载后会方便 Vite 缓存依赖，为 Vite 提效
  optimizeDeps: {
    include: ['antd', '@ant-design/icons', 'react', 'antd/es/dropdown/style'],
  },
  //  dev 服务器的配置
  server: {
    port: 32001,
    host: 'localhost',
    https: true, //  这里是开启 https ，记得使用 vite-plugin-mkcert 制作本地证书
    open: '/',
  },
  //  可以用来定义 Vite 的全局常量，例如兼容 webpack 中的一些环境变量
  define: {
    'process.env': process.env,
    XXXX: xxxx,
  },
});
```

<br />

### 🚪 入口文件

#### HTML

`Vite` 会读取一个 html 文件作为入口地址，还可以指定一个 public 文件夹存放项目的简单的静态资源，例如图标、图片等内容。(注意 html 文件和 public 静态资源需要分离开)

因此，我们需要做的就是将目前原项目中的 index.html 文件复制一份后，将其中的 `%PUBLIC_URL%/` 都删去即可，`Vite` 会自动解析然后完成这一步转化。

_项目兼容_ `webpack` _和_ `Vite` _最好提供两个 index.html 文件_ _项目根目录_

```javascript
// webpack index.html 开发环境的配置：
new HtmlWebpackPlugin({
  title: 'xxx',
  template: path.join(__dirname, '../src', 'index.html'),
  filename: 'index.html',
}),
```

#### 引入 JavaScript

`Vite` 的入口文件是 HTML ，而引入 `JavaScript` 就需要我们利用好浏览器自身的 `ES-Module` 。

具体方法直接 HTML 文件中指定一个 `JavaScript` 的入口文件即可 `<script type="module" src="...">` Vite 会帮我们去解析并通过给浏览器读取。

当然，有时候我们的入口文件并不是纯 `JavaScript` ，也可能是 `React-JavaScript` ，这时就需要 `Vite` 的一些插件来帮助我们进行预处理了，具体可见上文的配置详解。

基本完成了这一步就可以先启动项目项目体验尝试一下了。

```javascript
// package.json
   {
     "scripts":{
       "dev": "vite --https --config url/vite.config.ts",
     }
   }
```

#### 引入 CSS

通常项目都是通过 JavaScript 来引入，我们只要指定好相关入口文件即可。当然原项目中可能会通过 HTML 文件引入其他的一些样式表，具体的项目具体分析。

<br />

### ❓ 常见问题

#### 项目能启动，但组件样式异常

项目中可能使用了一些第三方的组件库，容易出现样式文件没有被全部引入的问题。我们可以通过手动在 JavaScript 中手动引入全局的样式表来检验问题是否存在。

这一步可能需要和 webpack 的入口文件拆离开，避免非必需的引入（下文会详细解答如何通过动态引入解决这一问题，现在我们只需要关注问题是否存在）

以 antd 为例：`import 'antd/dist/antd.min.css`'

项目中的 body 元素的高度可能没有撑开，短平快 `style="height: 100vh;"`

#### less/sass 引入报错：

检查`vite.config.ts`中是否已经配置支持 JavaScript 预编译，详细见上文配置

#### 存在多个入口文件还和 webpack 耦合在一起看起来项目变得更臃肿：

拆分配置文件，认真管理项目工程的目录，指定好资源的相对位置

```bash
# config/*
config
├── vite.config.js
├── webpack.common.js
├── webpack.dev.js
└── webpack.prod.js

# 命令启动时指定配置文件
vite --config ./config/vite.config.js
webpack serve --open --config ./config/webpack.dev.js
webpack --config ./config/webpack.prod.js
```

#### 遇到非 `ES-Module` 方式引入的包怎么办？

`Vite` 在预编译的时候会进行相关的处理，预编译构建以及自定义处理可以看这篇文档：依赖预构建，在下文「尽量避免编译」中也会提及

<br />

## ⚡️ 提效

`Vite` 不是仅仅地把编译过程从全局切片搬迁到浏览器那么简单，如果单单完成了上述过程，只能说项目拥有了 `Vite` ，与 `webpack` 相比在每次启动的时候确实会提速不少，但是页面加载却依旧走了 `webpack` 的老路。

这样的问题表现就是把 `webpack` **打包编译的时间花在了** `Vite` **首屏渲染上**。原因是入口文件通常会引入项目所需的大部分资源，`webpack` 还存在一个代码压缩的过程，如果纯靠 `ES-Module` 引入源码，可能资源占用反而更多了，导致体验并没有比 `webpack` 提升多少。

不过 `Vite `最大的好处就是够轻，够插件化，我们可以随时去验证我们的想法和优化。以下就是我对性能优化的一些尝试，也可以认为是我个人的一次最佳实践分享，相信其他的伙伴也会有自己不同的想法，就用`Vite `去大胆探索吧！

<br />

### 🌍 HTTP2 多路复用

**WHY HTTP2 ？**

由于前端项目中的组件拆封、目录设计，往往一份文件中会引入许多资源，同时这些资源往往都是很小的。从网络传输的表现上来看，建立链接的过程与传输内容大小消耗的网络资不对应，网络性能反而消耗在「建立链接」上了，即使存在通过复用链接，但还是容易出现队列阻塞的问题。这个场景就特别适合 HTTP2 协议，使用分帧和并发的解决方案快速解决问题。

**HOW HTTP2 in Vite？**

1. **OPEN HTTPs**

  开启 http2 的前提是需要有传输安全协议的支持，因为我们通过上文配置中提及的创建本地证书插件 `vite-plugin-mkcert` 来达到满足这个限制。

2. **Vite OPEN HTTP2**

  `Vite` 的 server 配置中开启 https 后默认就是使用 HTTP2 协议，但由于框架源码的限制，开启 https 后如果使用了反向代理，即 proxy 配置则会切换成 http1.1 ，这里设计的原因我们不细究。可以通过上文提及的 `vite-plugin-http2-proxy` 屏蔽这一限制。

<br />

### ⚙️ 资源动态引入

如果说 HTTP2 是在网络传输部分减少资源消耗，那么动态引入就是在代码上管理引入，减少不必要的资源被提前载入，更好的「切片、分包」。

我们依旧可以通过「网络传输」来看我们项目在启动时消耗较多性能的是哪些大文件，避免进行无效地优化，小文件直接交给 HTTP2 处理即可，无需关心。

<br />

找到大文件后，要考虑好**两个最核心的问题**：

- 是否需要将该文件进行动态引入？

- 是否能够将该文件进行动态引入？

<br />

以 `ViMo` 的工程项目为例子 🌰 ：

- 在 `ViMo` 项目中，占用较多的是 `antd` 组件库相关资源以及 `react` 库相关资源。这里 `react` 库相关的很明显就不适用于动态引入，在首屏加载中就应当被加载完毕。

- 而 `antd` 组件库就是适合动态引入的而且也是能够被动态引入的，用到什么组件我们再拿什么。_（不过这里为了后续渲染其他页面的效率，项目只将 antd 组件中的样式文件进行了动态引入）_

<br />

**进行动态引入的具体方式**：

- `ES-Module` 懒加载，`async () => await import('xxx') `这里就不过多赘述了

- `vite-plugin-imp` 管理 `Vite` 的引入，使用的方法也很轻便。这里分享一套项目中使用的 `antd` 引入的实践，减少踩坑

```javascript
vitePluginImp({
  libList: [
    {
      libName: 'antd',  //  限定包名，由于 antd.js 在入口文件已全局引入，所以这里可以只管理样式文件
      style: name => {
        //  row/col 并无有效样式，请使用 grid
        if (name === 'row' || name === 'col') {
          return `antd/lib/grid/style/index.css`;
        }
        //  table 中存在配置化的「分页」组件，需引入相对应的包，其他组件同理
        if (name === 'table') {
          return [`antd/lib/${name}/style/index.css`, `antd/lib/pagination/style/index.css`];
        }
        //  弹框组件需引入所有 style/ ，index.css 文件中引用不全
        if (name === 'dropdown') {
          return `antd/es/${name}/style`;
        }
        //  其余组件正常引入即可，引入 css 文件的原因如下文描述：「尽量避免编译」
        return `antd/lib/${name}/style/index.css`;
      },
    },
  ],
}),
```

<br />

### 💡 尽量避免"编译"

> 1. 浏览器的三大核心资源：`HTML、JavaScript、CSS`，能直接给浏览器提供这些资源，就不必要通过 `Vite` 转化。
> 2. 必须编译的大文件，尽量通过缓存减少编译的次数，「一次“编译”、多次运行」。 依旧推荐大家看官方文档：依赖预构建

<br />

**为什么 `Vite` 需要预构建？**

处理非 `ES-Module` 的代码，这里会执行自动寻找相关依赖并进行处理，但无法保证处理完全覆盖。当出现异常运行报错时还需要手动进行解决处理，如更新 `optimizeDeps` 的配置，或者修改源码引入方式

`Vite` 能自动将` ES-Module` 部分包内部的多个依赖关系打包成模块，帮助我们减少建立网络链接的数量。以官网文档举例：“ 例如，`lodash-es` 有超过 600 个内置模块当我们执行 `import { debounce } from 'lodash-es'` 时，浏览器同时发出 600 多个 HTTP 请求！......通过预构建 `lodash-es` 成为一个模块，我们就只需要一个 HTTP 请求了！”

核心：**上述预构建后的产物会进行缓存，大大加快下次启动后获取资源的数据**

```bash
 node_modules/.vite/deps
     ├── @ant-design_icons.js
     ├── @ant-design_icons.js.map
     ├── antd.js
     ├── antd.js.map
     ├── ....
     └── react.js.map
```

<br /> 

`Vite` **又是如何做到「缓存」这一点的呢？** (强制更新的命令：`vite ... --force`)

简单解析这个过程就是：检查以下文件是否改动，从而触发重新构建

   - `package.json` 中的依赖（开发依赖不追踪）
   - 各类包管理的器的版本文件 `package-lock.json`
   - `vite.config.ts` 中包含的自定义配置项

`Vite` 开发服务器的网络协议缓存配置：强缓存 `max-age=31536000,immutable` 即缓存一天

<br /> 

**在工程项目中我们需要手动参与配置的地方**：

需要配置的地方仅在于 `vite.config.ts` 的「自定义配置项」之中

这里配置的核心要素要和上述提及的原生预构建过程相吻合：

1. 处理非 `ES-Module` 的代码

2. 优化性能

在 ViMo 项目中，我选择利用该配置将`react 、 antd`相关的资源都进行了一次预构建，即使 `Vite` 在自动依赖寻找的时候大概率也会覆盖这些内容，但手动配置后能确保一定被覆盖到。

以下为具体配置：

```javascript
optimizeDeps: {
  include: ['antd', '@ant-design/icons', 'react', 'i18next','antd/es/dropdown/style'],
},
```

<br />

## ⌚️ 结果如何

> M1 跑项目真的很快，可能结果对比不大 hhh ，强烈推荐一下开发选手考虑一下 MacOS

| 框架    | 首次加载资源 | 开发时平均启动速度 | 热更新速度 |
| ------- | ------------ | ------------------ | ---------- |
| webpack | 18s          | 18s                | -          |
| vite    | 9s           | 1~2s               | -          |

## 😊 结语

Vite 很快也很轻，推荐在前端项目中多引入尝试。

以上就是一次「最佳实践」的过程，有兴趣的伙伴可以立刻上手尝试并验证一次，如果有其他优化想法和更复杂的业务配置要求，欢迎和我联系，我们一起多探讨！^V^ ～
