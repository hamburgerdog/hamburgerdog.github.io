---
title: 'CDN 简记'
date: 2024-05-24 17:30:00 +0800
tags: 前端 精选
subtitle: 'A content delivery network 内容分发网络'
---

# CDN 简记

> CDN：A content delivery network 内容分发网络

![CDN分布网络](https://cf-assets.www.cloudflare.com/slt3lc6tev37/7Dy6rquZDDKSJoeS27Y6xc/4a671b7cc7894a475a94f0140981f5d9/what_is_a_cdn_distributed_server_map.png)

<br/>
<br/>

## CDN 原理介绍

> CDN 可以类比成某东之家，你在网购时，直接从最近的物流仓给你发货，如果没货就去源产地调货。

具体的实现方式为：

1. 在 DNS 解析的一层加上 CNAME ，从而在客户端访问某一 URI 时，通过 DNS 获取到的不是一个 IP 地址，而是指向一个 CDN 的服务器的 CNAME；
2. CDN 服务器会解析客户 IP 地址，找到距离客户端最近的一个资源节点返回给用户；
3. 客户端访问资源节点获取资源，资源节点返回缓存资源，如果不命中，则先上级请求；
4. 用户获取到最终的资源并展示。

![图源来自阿里云](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0988696361/p352419.png)

<br/>

### DCDN 动态数据的分发

CDN 面向的都是静态资源，相当于是一个缓存层，而对于应用中的 API 返回的动态数据是无法做到缓存的，因此还有一种 DCDN 的方案来实现全站的提速。

DCDN 的全称为 Dynamic Route for Content Delivery Network ，核心概念是 `Dynamic Route` 动态路由，即利用现有部署的节点，动态选取一条最优路径直达资源服务器。

在这一层上 DCDN 运营商通常都会提供三大能力：

1. 加速服务：转发流量，动态路由选取最优路径；
2. 边缘计算：节点支持部署服务，就近处理客户端请求，减轻资源服务器的流量压力；
3. 安全防护：隔离资源服务器，避免恶意攻击直接访问到服务器。

![图源来自阿里云](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0883817961/29c121b04bkau.svg)

「边缘计算」对于 SSR 架构的应用是很有用的，有效的减轻了资源服务器的运算压力，还能利用最近的边缘节点实现 CDN 般的快速访问

<br/>
<br/>

## CDN 在 web 中的应用场景

### 1. 静态资源加速

如视频、图片、JS、css 等文件都能直接托管到 CDN 上，就近为用户提供服务。

用户访问的是 CDN 节点，从而减少了对资源服务器本身的访问，减少了服务器的压力。

访问速度提升不仅有助于用户体验，还能在 SEO 上提升得分。

<br/>

### 2. 灰度测试发布

> canary 版本，灰度即从黑到白平滑过渡，让部分用户先体验新版本，再过渡到全量用户，有助于及时收集用户反馈

可以自由控制 CDN 节点提供的资源，从而做到 A 区域访问 A 资源，B 区域访问 B 资源。

在上线新功能时，可以先选取若干区域的资源先更新，搜集新版本的意见反馈，即灰度发布。

<br/>

### 3. 服务安全、容灾

CDN 会对访问进行控制，相当于把资源服务器当成了沙箱隔离开，从而避免了攻击者通过托管资源直接攻击到服务器本身。

CDN 存在大量资源节点，在某一资源节点不可用时，可以临时调度其他节点的资源，扛风险的能力更大。

在资源流量增大时，还能使用更多节点来提供资源，具备很好的扩张性。

<br/>
<br/>

## 如何在应用中使用 CDN

Web 应用的统一入口通常是服务器提供的 index.html ，再通过 HTML 去访问 CSS、JS 等资源，把 HTML\CSS\JS 等静态资源都托管到 CDN 后，以为应用需要将 index.html 中 CSS、JS 的资源指向都修改到 CDN 上去。

以 webpack 为例，通常都会使用 `HTMLWebpackPlugin` 来生成最终的 HTML 产物，此时，只需要将 `output.publicPath` 指向 CDN 即可。

```js
//	webpack
module.exports = {
	...
    output: {
        filename: 'bundle.js',
        path: __dirname + '/dist',
        publicPath: 'https://cdn.example.com/' // 配置 CDN URL
    }
  ...
}

//	vite
export default defineConfig({
  base: 'https://cdn.example.com/', // 配置 CDN URL
  ...
});

```

注意，后续 index.html 不能使用任何缓存，否则 CDN 的更新都无效。最佳实践是 HTML 不缓存，JS 和 CSS 使用 `hashcontent` 并缓存，只更新 HTML 即可。

<br/>
<br/>

## 那么 CDN 的代价是什么？

**存在的风险：**

1. 内容篡改

   CDN 运营商可能会篡改资源，导致用户、服务器数据泄漏

2. 跨域攻击

   当服务器跨域资源配置不合理时，容易被攻击，CDN 被攻击时还可能因此会泄漏源服务器中的数据

3. 缓存更新不及时

   CDN 节点自身存在缓存更新的策略，可能会遇到提供的资源较旧的问题

4. 缓存投毒

   CDN 节点被攻击，缓存资源有可能会被替换成恶意攻击的内容

<br/>

**应对的方案：**

1. 使用 HTTPS ，通过证书来保证通信数据的加密安全；
2. 必要时，使用内容检测，保证前后请求的内容完全一致；
3. 定期检查 CDN 提供的资源，避免 CDN 被攻击后提供恶意资源；
4. 设置严格的缓存策略，并支持清除缓存的操作；
5. 不在 CDN 上传输敏感数据，并对敏感数据进行加密；
6. ....
