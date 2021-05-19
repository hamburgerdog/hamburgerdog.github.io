[toc]

# :musical_keyboard: 讲一讲「My_little_airplay」

关于这个前端项目虽然小且简单，但其功能实现所使用的方法（库）都还是蛮实用的，如**统一包装Axios的AP**I设计、`$EventBus`的封装（**观察者模式**）等还是值得总结提炼一下帮助加深记忆的，最近面临实习、秋招也顺带借这篇文章梳理一下项目的结构。由于本人技术尚浅，肯定有很多不足的地方可以提炼重构，请多担待~​ :smile:

## :page_facing_up: 从项目根目录下的配置文件们讲起

该项目使用的`@vue-cli`构建的，因此在项目创建之初会依照我们的选择来自动创建若干个配置文件，比如从***package.json***到***.browserslistrc***等若干文件就对应的配置好了项目所依赖的插件，从最熟悉的***package.json***开始

#### :one: package.json 

* ***package.json*** 这个文件里放的就是我们项目的依赖，通过`npm list`可以查看所有依赖，还可以配置一些脚本搭配`npm | yarn`来使用，***package-lock.json、yarn.lock***这两个文件是用来保证依赖一致性的，即不仅版本(version)一致，其来源(resolved)也应当一致，不过lock文件更侧重项目依赖，而package文件则着眼项目全局，没有lock项目依旧是可运行的。

  ***yarn.lock***与***package-lock.json***的差异在于依赖扁平化的处理，yarn的处理方式是把所有依赖都平铺没有层级关系，而npm的处理是嵌套的，即第一次出现的包名会被提到顶部，一些常用的依赖可能被多个包重复引用，因为层级关系被包含到了不同的依赖里（不完全扁平），导致不必要的资源浪费。

  <u>*（唬烂三小，请跳过）这是一个我们再熟悉不过的配置文件了，说`npm init`这条命令是前端学习者的导师没有人会不认同，其重要性不言而喻，因此我们在这里出于礼貌也应当敬重地来重温一下相关知识。*</u> 

  <u>*推荐阅读~*</u>:point_right:[package-lock.json和yarn.lock的包依赖区别](https://segmentfault.com/a/1190000017075256)

#### :two: vue.config.js

* ***vue.config.js***既然是`@vue-cli`项目，当然少不了这个配置文件，这个配置文件是被`@vue-cli`自动扫描的，该文件提供了一些字段来配置`@vue-cli`的行为，如更换项目地址、静态资源存放地址、是否包含vue编译版本等功能，还可以通过`chainWebpack`来修改***webpack***，如我们常用的为项目资源路径起别名来方便引入：

  ```js
  const path = require('path');
  const resolve = dir => path.join(__dirname, dir);
  
  module.exports = {
    chainWebpack: config => {
      config.resolve.alias
        .set('@', resolve('src'))
    }
  }
  
  //	使用方式：import xxx from '@/aaa/bbb'; -> 'src/aaa/bbb'
  ```

  还可以进行api请求代理(`proxy字段`)、关闭eslint检查(`lintOnSave`)、编译后修改路径(`publicPath`)等操作

#### :three: browserslistrc & editorconfig

* ***.browserslistrc***这个文件用于配置浏览器兼容，按官方说法是：**'The config to share target browsers and Node.js versions between different front-end tools. '** 这里的工具常见的有 babel | eslint | postcss 等，语义特别简洁明了，如下：
  
  `defaults`: Browserslist’s default browsers (`> 0.5%, last 2 versions, Firefox ESR, not dead`).
  
    `last 2 versions`:各类浏览器中最新的两个版本
  
    `no dead`:不要超过二十四个月没有官方维护、更新的浏览器，当前指`IE 10`和`IE_Mob 11`
  
    <u>*推荐阅读~*</u>:point_right:[browserslist项目地址](https://github.com/browserslist/browserslist)*</u>
  
* ***.editorconfig***顾名思义这个配置文件就是用来统一配置文本编辑器的，这样可以使代码格式更加统一，方便阅读，经常搭配`ESLint`来使用，不过在使用vscode的format功能的时候最好需要配置一下用户设置（直接安装的插件也行***EditorConfig for VS Code***）如尾逗号的处理、文件末尾另起新行，当然也可以直接修改***.editorconfig***文件，比如使用`tailwindCss`的时候最好把`max_line_length`设长一些。

#### :four: eslintrc & babel.config

* ***.eslintrc.js***重头戏！Eslint是一个让人感受短暂痛苦但又一定离不开的开发工具，主要用来统一代码规范，优化代码结构，而该文件就用来配置这个工具，我们可以为其拓展一定的风格指南，项目中就参照了`airbnb`风格的规范。当前我在个人项目中通常都是直接按照默认规则来使用的，有时候嫌烦会使用`// eslint-disable-next-line`屏蔽掉一些警告（很讨厌返回无名函数的警告），如果是多人项目最好还是依照项目统一的格式来书写代码，尽量不用屏蔽语句，遇到奇怪的报错可以查漏补缺还是很值得的！

  <u>*推荐阅读~*</u>:point_right:[Eslint的文档地址](https://eslint.org/docs/user-guide/configuring/)

* ***babel.config.js*** Babel也是当前开发必不可少的工具，主要功能就是自动实现一个ES版本兼容的转换（ES6 -> ES5），就如中文官网的口号一般 **“今天就开始使用下一代的 JavaScript 语法编程吧！”** 它的出现让我们很大程度上摆脱了各种兜底（polyfill）代码的编写（需要Babel-polyfill插件的支持），因为babel支持的是es6语法新特性的转换，让浏览器看得懂ES6代码，对于ES6中各类新api的转换还是要依靠插件，Babel的插件众多也成就了它功能的丰富程度。

  <u>*推荐阅读~*</u>:point_right:[一口（很长的）气了解 babel](https://zhuanlan.zhihu.com/p/43249121)

## :european_post_office: 「网络」 Axios 和 API 的封装

#### :one: axios

axios的使用就不用再赘述了，这里主要讲项目是如何将axios封装起来进行异常处理的。

**问题：**在项目初期axios是被各个组件中直接引入使用的，没有考虑统一的异常处理，那时组件少，使用catch来捕捉异常的工作量完全可以应付，但当组件变多后逐一添加catch就力不从心了。

**分析：**据此分析我们需要将axios先进行一次的封装（代理 | 切面）以便出错时能弹出默认提醒，让组件使用axios时自动拥有最基本异常处理功能，同时为了让每个组件不丢失自定义异常处理的功能，我们应当让axios的回调能继续被调用。观察axios的大致逻辑我们就可以找到关键的切入点，<u>构建axios>>发送请求>>收到响应>>执行回调</u>，答案呼之欲出！我们只需要在收到响应后做一层封装然后让其继续执行指令即可，axios也提高了对应的钩子来给我们使用，即响应拦截器。

**实现：** talk is cheap, show me the code

```javascript
import axios from 'axios';
import { Notify } from 'vant';

//  网络失败的警示，使用vant的通知组件
const dangerTip = (msg) => {
  Notify({
    background: '#fe5f64',
    message: msg,
  });
};

//  错误处理函数
const errorHandler = (status, other) => {
  switch (status) {
    case 404:
      dangerTip('【请求失败】请求内容不存在');
      break;
    case 500:
      dangerTip('【请求失败】服务器错误');
      break;
    default:
      dangerTip(other);
  }
};

//  axios的默认配置
const instance = axios.create({
  //  超时时间为10s
  timeout: 1000 * 10,
});
instance.defaults.headers.post['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';

//  重点：拦截器！
instance.interceptors.response.use(
  (res) => {
    if (res.status === 200) {
      return Promise.resolve(res);
    }
    return Promise.reject(res);
  },
  (error) => {
    const { response } = error;
    if (response) {
      errorHandler(error.status, error.data.message);
    } else {
      dangerTip('【网络错误】网络连接失败');
    }
    return Promise.reject(response);
  },
);
export default instance;
```

在拦截器中我们先判断axios的请求是否执行成功，如果成功收到响应了则还要判断收到的响应状态码以确认服务器响应的是否有效，这里使用的提醒是 vant 中的全局组件，其他的axios详细配置可以参照[axios文档](https://www.kancloud.cn/yunye/axios/234845)，这样我们就封装好了axios，在将其挂载到Vue实例的原型链上就成了一个全局方法，将其命名为`$http`你就自己实现了一个简单的`vue-axios`​​(不是)。

**思考：**但这样的方法还是要在组件中直接使用axios，我们能不能再进行一层封装呢？如果组件中只需要把后端看成数据库，通过DAO（概念）就可以直接拿到数据不就更好了吗？这就是接下来我要说的API封装了。

**唬烂三小：**每每这个时候，我都要想起组网老师对我的一句教导：“同学，你要不就再多套几层吧？” 很感慨，时光荏苒，我终于还是到了听懂这句话的年纪。

#### :two: API

在用Spring写接口的时候我们用到**controller来将请求分成一类**，再由service等一层一层地去处理数据，那我们写前端的时候还有什么理由不把像这样**将API归类管理**起来呢？更何况这样的操作实际并不复杂。

首先我们把**请求分类**，项目中的**专辑、歌曲**就是这两个类，然后在这两个JS文件引入**封装好的axios来发送请求**，将不同请求抽离成函数，最后函数返回axios.method()的返回值即可（**即Promise对象**），我们把这两个类暴露出去，再使用一个**统一的API类来向项目提供这两个类**，把API类挂载到全局对象即可全局使用了。

以歌曲API为例：

```javascript
//	song.js
import axios from '@/utils/http';
import base from './base';

const song = {
  //  搜索歌曲功能
  searchSongByName(name) {
    return axios.get(`${base.mlaUrl}/song/name/${name}`);
  },
  getRandomSongsWithLimit(limited) {
    return axios.get(`${base.mlaUrl}/song/random/${limited}`);
  },
};

export default song;

//	api.js
import song from '@/api/song';
import album from '@/api/album';

export default {
  song,
  album,
};

//	main.js
import api from './api';
Vue.prototype.$api = api;

//	组件中使用
this.$api.song.searchSongByName(this.searchName).then().catch();
```

这里还有一个问题，即请求的地址要怎么配置？这里有很多方式：如项目配置代理、硬编码、使用静态文件读取等... 这里我使用的是将其保留到 ***base.js*** 一个js文件中，然后引入使用，这样做其实是不太方便的，比如要修改的时候需要重新编译，很死板。另一个好方式的就是让项目去静态资源中读取，这样可以实现热更新这里不细讲了。

<u>*具体可以参考*</u>:point_right: [如何修改Vue打包后文件的接口地址配置](https://www.cnblogs.com/webhmy/p/9517680.html)









