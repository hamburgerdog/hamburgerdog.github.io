---
title: 'Canvas 填充规则'
date: 2024-01-09 18:30:00 +0800
tags: 前端 精选
subtitle: 'evenodd & nonzero'
---

# Canvas 填充规则

> [MDN-Canvas.context2D.fill(path, fillRule)](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fill) 关于 `fillRule` 的介绍，并分享一个业务上遇到的有趣案例。

## fillRule 原理

该属性对应了两套填充规则，这两套填充规则不仅在 Canvas 中发挥作用，在 SVG 等常见图形绘制的领域也十分常见。但其中的原理相信很多人都是一知半解，这篇文章就来介绍一下这两套填充规则：

- evenodd（奇偶规则）

- nonzero（非零填充）

![fillrule](../../assets/fillrule/rule.png)

### evenodd（奇偶规则）

规则：从任意一点向外发送一条射线，每经过一条线就记录一个交点，最后计算交点数量。如果是奇数，则判断为该区域需要填充，反之则不需要填充。

![evenodd](../../assets/fillrule/evenodd.jpg)

### nonzero（非零填充）

规则：从任意一点向外发送一条射线，每经过一条线就计算方向，方向为以射线指向为箭头方向，计算与线形成的折线的时钟方向，顺时针则 +1，逆时针则 -1，最终结果如果非零，则判断为该区域需要填充，反之则不需要填充。

![nonzero](../../assets/fillrule/nonzero.png)

## 应用场景

这两个填充规则在多数情况下我们其实并不了解会产生什么样的差别，所以接下来这个案例或许可以给你一个参考的方向。

在做图像分割时，我们常常会在该领域里遇到一类场景：将 Mask 数据转化成坐标，变成用 Polygon 多边形来表示，例如对应 openCV 中的轮廓提取算法。在这类轮廓提取算法中就会涉及到对孔洞的处理

![evenodd_result](../../assets/fillrule/evenodd_result.png)
![nonzero_result](../../assets/fillrule/nonzero_result.png)
