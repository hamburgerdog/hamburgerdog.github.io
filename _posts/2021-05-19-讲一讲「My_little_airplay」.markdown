---
layout: post
title:  "讲一讲「My_little_airplay」"
date:   2021-05-19 19:00:00 +0800
tags: 学习 vue
color: rgb(255,210,32)
cover: '../assets/mla.png'
subtitle: 'vue项目总结'
---

[toc]

# :musical_keyboard: 讲一讲「My_little_airplay」

关于这个前端项目虽然小且简单，但其功能实现所使用的方法（库）都还是蛮实用的，如**统一包装Axios的AP**I设计、`$EventBus`的封装（**观察者模式**）等还是值得总结提炼一下帮助加深记忆的，最近面临实习、秋招也顺带借这篇文章梳理一下项目的结构。由于本人技术尚浅，肯定有很多不足的地方可以提炼重构，请多担待~​ :smile:

## :page_facing_up: 从项目根目录下的配置文件们讲起

该项目使用的`@vue-cli`构建的，因此在项目创建之初会依照我们的选择来自动创建若干个配置文件，比如从***package.json***到***.browserslistrc***等若干文件就对应的配置好了项目所依赖的插件，从最熟悉的***package.json***开始

#### :one: package.json 

* ***package.json*** 这个文件里放的就是我们项目的依赖，通过`npm list`可以查看所有依赖，还可以配置一些脚本搭配`npm \ yarn`来使用，***package-lock.json、yarn.lock***这两个文件是用来保证依赖一致性的，即不仅版本(version)一致，其来源(resolved)也应当一致，不过lock文件更侧重项目依赖，而package文件则着眼项目全局，没有lock项目依旧是可运行的。

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

* ***.browserslistrc***这个文件用于配置浏览器兼容，按官方说法是：**'The config to share target browsers and Node.js versions between different front-end tools. '** 这里的工具常见的有 babel \ eslint \ postcss 等，语义特别简洁明了，如下：
  
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

**分析：**据此分析我们需要将axios先进行一次的封装（代理 \ 切面）以便出错时能**弹出默认提醒**，让组件使用axios时自动拥有最基本异常处理功能，同时为了让每个组件不丢失自定义异常处理的功能，我们应当让axios的回调能继续被调用。观察axios的大致逻辑我们就可以找到关键的切入点，<u>构建axios>>发送请求>>收到响应>>执行回调</u>，答案呼之欲出！我们只需要在收到响应后做一层封装再让其继续执行指令即可，axios也提高了对应的钩子来给我们使用，即响应拦截器。

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

## :grey_question: 「搜索框 - 动画」节流和防抖

#### :one: 搜索框

**需求：**我们在搜索的时候需要让用户在输入的时候能得到一定的响应，但又要限制用户在该时间段里不能发出太多请求，这时候我们就可以选择用节流来对搜索功能进行优化。

<u>*节流：使用阀门的概念来理解就是每隔一段时间泄一次洪，要让数据能流出去又不至于洪泛。*</u>

**实现：**节流功能需要借助一个状态来判断当前是否要响应事件（即阀门的开启与否），初始时阀门打开，确认阀门当前处于开启状态后就可以为响应目标函数做准备，准备期间需要先将阀门关闭屏蔽外界的响应（关中断....），执行目标函数后再将阀门打开即可，把要目标函数包装成定时任务就可实现每隔一段时间响应一次。

```javascript
//  节流函数
function throttle(fn, delay = 500) {
  let timer = null;		//	在下次执行前如果定时任务未完成则清楚定时任务
  let canRun = true;	//	阀门

  return function () {
    //	当前不营业
    if (!canRun) return;
    canRun = false;		//	关阀门
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn();
      canRun = true;	//	开阀门
    }, delay);
  };
}
```

直接使用的` fn()` 是最简化的模式了，实际上我们在`fn()`中必须考虑使用this和传参数的问题，因此在这里我们要写成`fn.apply(this, arguments) \ fn.call(this,...) \ fn.bind(this)`。

这里还有另一种写法是将`fn()`放置到定时器的外面变成立即执行的函数，具体采用哪种方式还是依据个人选择，功能上的差异是不大的。

#### :two: ​动画

**需求：**项目中使用了***Animate.css***动画库来实现某些组件在点击后触发某些动画，同时要屏蔽用户的重复点击事件，不然动画就会出现鬼畜效果。

**实现：**使用css动画库要求我们在处理点击事件的时要修改类名，触发事件时添加类名以触发动画，事件结束后删除类名以方便下次触发动画，要屏蔽用户重复点击事件使用定时任务即可，这里我想让用户有一个重复点击蓄能的体验，即事件不是第一时间响应的，要留有一定的缓冲期，在用户停止点击后再执行动画，这就需要使用到防抖了。（有种面向答案出题的感觉）

<u>*防抖：使用定时器来执行任务，在定时任务未被执行前又触发了事件则需要重设定时器。*</u>

```javascript
//	防抖
function debounce(fn,delay){
    let timer = null 									//	闭包
    return function() {
      	//	重置与否
        if(timer){
            clearTimeout(timer) 
        }
        timer = setTimeout(fn,delay) 	//	设置定时器
    }
}
```

可以看到防抖和节流其实很相似，其核心思想都是尽可能少的触发目标事件，节约资源。

#### :three: 操作类名的小知识点：`classList`

> *`elementClasses`* 是一个 [`DOMTokenList`](https://developer.mozilla.org/zh-CN/docs/Web/API/DOMTokenList) 表示 `elementNodeReference` 的类属性 。如果类属性未设置或为空，那么 *`elementClasses.length`* 返回 `0`。虽然 *`element.classList`* 本身是**只读**的，但是你可以使用 `add()` 和 `remove()` 方法修改它。 - [MDN Web Docs](https://developer.mozilla.org/zh-CN/docs/Web/API/Element/classList)

答应我，不要再用`className`了好吗？classList提供了`add() \ remove() \ replace() \ taggle()`这四种方法大大方便了我们操作类名。不过 Vue 中是不推荐我们直接操作dom的，如果还有其他更好的实现方式都值得我们去了解一下。

## :earth_asia: 自定义全局API -  eventBus & global

#### :one: eventBus \ 观察者模式

**需求：**在项目中有一个播放器组件(vue-aplayer)，我们需要在很多组件更新其播放数据，如在搜索组件中，用户搜索到歌曲后要添加到播放器组件中，专辑列表需要一次性大量添加歌曲，将通知绑定在父子孙组件上进行组件间通信的方式显示是过于繁琐不合适的，这时候我们可能会想如果组件间收发“短信”问题就容易解决了。

**思考：**我们都学过计算机网络，那么模仿网络通信的方式我们可不可以也在vue中实现“端口”监听呢？学过 vue 的我们可能就会想起一个叫做 vuex 的工具，但也正如其文档所写：“如果您的应用够简单，您最好不要使用 Vuex。” 显然，mla项目很符合「简单」的定义，为项目引入 vuex 远远超过了够用即可的原则（我的原则）。还好我们有另一种选择，vue.api 为我们提供的 `$on`和 `$emit`函数实现“端口”监听 :point_right: [vue-api](https://cn.vuejs.org/v2/api/#vm-on)

**实现思路：**既然vue的实例有提供用于监听的API，那我们直接注册一个空的vue实例并将其挂载到vue原型链上，或者直接绑定到根实例的数据中，那我们不就可以在全局使用了吗？这个实例就像是邮差，其有个通用的名字叫***eventBus*** 没错，其和计算机中的总线的概念是一致的！接下来的代码实现就简单了

```javascript
//	main.js
Vue.prototype.$eventBus = new Vue();	//	挂载到原型链上

//	app.js
mounted(){
  this.$eventBus.$on('getRandomSong', (load) => this.addSong(load));
}

//	RandomPlay.vue
this.$api.song.getRandomSongsWithLimit(1).then((resp) => {
        this.$eventBus.$emit('getRandomSong', resp.data[0]);
});
```

这里要注意的重点问题是`$on`一定要比`$emit`先调用，必须先监听再触发，如果两个组件没有依赖关系都加载完了，则放在`mounted()`钩子上就好了，但如果是A组件先加载后才会加载B组件，是有顺序的，那么A中的监听必须放在`mounted()`钩子运行之前，而B中的必须放在`beforeDestroy`及之后，否则不起作用。

<u>*在项目中最好是使用一个bus.js来提供vue实例对象，这样通过统一的引入更规范也便于观察。同样简单场景直接用 `this.$root.$emit` 和 `this.$root.$on `也是一样的，可以少初始化一个 Vue 对象*</u>

观察者模式（发布/订阅模式）就不展开了，看代码就能基本了解了，其在vue源码中也有大量的应用，如数据变化侦测的功能实现，因此这个设计模式还是很重要的~ <u>*有兴趣推荐*</u>:point_right:《深入浅出vue.js》

#### :two: global

这是一个工具类，其中存放了一些全局可使用的函数来简化编码操作，如防抖节流函数就很适合放在这里，还有上文提到的操作类名的方法也被抽离到了这里。在项目中对应是***global.vue***，这和 ***.js文件*** 是一样的，在项目中纯粹是为了验证 ***.vue文件*** 引入的效果。

全局即代表我们在***main.js***中将其绑定到了原型链上，这和`$eventBus`的操作是一样的，因此我们可以在多个组件中这样使用：

```javascript
//	main.js
import global_ from './Global.vue';
Vue.prototype.$global = global_;

//	global.vue
function addAnimateClass(element,
                         animateName,
                         delay) {
  element.classList.add('animate__animated');
  element.classList.add(animateName);
  setTimeout(() => {
    element.classList.remove(animateName);
  }, delay);
}

function deBounceAddAnimate(element, 
                            animateName,
                            canRun,
                            delay = 2000) {
  debounce(
    () => {
      addAnimateClass(element, animateName, delay);
    },
    canRun,
    delay,
  );
}

//	组件中
this.$global.deBounceAddAnimate(
          event.srcElement.parentElement,
          'animate__rubberBand',
          this.canPulse,	//	组件中的阀门
          2000,);
```

将阀门保存在组件中的好处是，每个组件触发事件是受组件本身控制的，各个组件可以使用统一的函数又不至于互相干扰。

## :zap: 小结

#### :lipstick: css

在这个项目中我花在写css样式上的时间占比是很大的，要实现组件的通用要考虑的因素有很多，一下几点是我在项目中收获比较多的。

* 我在写比较通的组件中的块级元素时会尽量不书写 width \ height 让其自然铺开，在使用这些组件时利用`flex布局`直接管理这些组件，如果需要留空尽量通过父元素或者`flex-gap`来实现

* 减少对vant组件库的依赖，vant修改默认样式是不太方便的，有时候vant组件提供的API是不够用的，在首页的轮播图组件中就遇到一个比较麻烦的问题：要给该组件设置圆角，但vant是不支持的，于是采用给组件的父盒子设圆角然后溢出隐藏的方式实现近似效果，但这会导致一个小问题，轮播图是带动画的，当动画播放时组件还是会撑开圆角，当动画结束时才会恢复圆角效果：
  ![动画过程](https://z3.ax1x.com/2021/05/20/goNirV.png)

  ![正常展示](https://z3.ax1x.com/2021/05/20/goNePJ.png)
  这样在视觉上的变动是很突兀的，但却又很难消除这个影响，我最后选择的方案是让圆角缩小以减少突变的程度。

* 响应式布局，从px -> em -> rem ，我们其实可以使用一些css框架来帮助我们进行开发，我很喜欢的一个响应式布局css框架就是 [tailwindcss](https://www.tailwindcss.cn/)，当然它还不局限于响应式！引用《css权威指南》中提起的一个很实用的概念：「不需要精确地去计算1rem等于多少px，只要知道“大概”多有宽就可以了」。这和`tailwindcss`中的大小描述方式是不谋而合的，在`tailwindcss`中描述文字大小用的是 ` xs\sm\base\lg\_xl `，描述宽度(高度)的时候使用的是`w-1\w-2\w-xx\w-2/3\w-1/3\w-full\...`这写背后转换后的单位都是rem，但具体是多少我们不需要考虑，除非要 1:1 精确的还原设计图。

  `tailwindcss`甚至是`windcss`的火爆大家都有目共睹了，在使用这些框架开发项目后我组件中`<style>`标签中的内容大幅度下降了，用`flex \ grid`布局也更得心应手了！真的香香

css要学习的东西有很多，有时候遇到各种怪异的问题处理起来是很棘手的，在另一个项目中我就遇到了 img元素 溢出 div 挤占了下行内容还解决不了的问题，对于各种css原理还是需要继续加强，这里推荐张鑫旭老师的[《css世界》](https://www.cssworld.cn/)系列书籍，属于细致到读每一章都能更新一次观念的书籍。

#### :coffee: 项目后端

项目的后端看 前端 ***api.js*** 就知道其实提供的接口并不多也不复杂，技术就是最常见的springMVC+mybatis，redis都没用上，因为没有什么可缓存的，如果一定要缓存甚至可以不用mysql，单一个redis就足够存放所有数据了。作为歌迷我是打心底里希望mla多出点歌，多出点专辑 :joy:

不过最后还是总结一下后端一些我觉得比较好玩的点吧

* 提供资源的方式：直接向前端提供静态资源存放的url，对于图片还有另一种方式：即***html页面的img***可以直接渲染base64编码的图片，`<img src="data:image/png;***"/>` 因此，对于较小的图片后端设计了一个返回`ResponseEntity<byte[]>`的接口，这样可以减少发送请求的次数。
* Controller中使用`ResponseEntity<>`用于返回响应数据是很有用，比如在请求mp3数据的时候，利用这个数据类型保存响应头并结合206状态码就可以在前端告知用户当前要响应的文件类型和大小，以便确认是否要下载了。
* 应当使用API文档生成的`Swagger2` 框架 和 日志系统`slf4j + log4j` 记录系统运行的情况，在服务器运行过程中搭配使用nohup命令将数据按日期存放到两个标准输出文件、错误输出文件即可。提到这两个是因为在项目中我并没有用这两个...... 实际上我知道也会用！我只是懒！
* `hutool`的使用，项目中大量使用该工具库用来实现json格式转换、文件读取等操作，对于开发真的很友好。

说到后端我们前端工程师绕不开的一个话题就是***golang***，go确实是一个很好玩的语言开发web比spring要轻便很多，项目中之所以不用GO是因为我接近三四个月没写GO有些遗忘了......... 菜是原罪。