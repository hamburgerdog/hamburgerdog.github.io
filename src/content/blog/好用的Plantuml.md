---
title: '好用的PlantUML'
date: 2022-05-03 18:30:00 +0800
tags: 生活
subtitle: '好用的PlantUML的读书笔记'
---

# plantuml

## 前言

> Plantuml 是一款使用命令绘制软件工程领域相关图形的工具，使用 Java 开发，markdown 利用相关的插件可以实现通过代码生成流程图、时序图、用例图等

## PlantUML 介绍

PlantUML 是一个开源的绘制 UML 图形的工具，它使用简单的文本语言描述 UML 图，然后将其转换为相应的图形表示。PlantUML 提供了一种更简单、更直观的方式来创建 UML 图，而不需要手动绘制图形。

以下是一些 PlantUML 的基本特点和用法：

文本描述： 使用 PlantUML，您只需使用简单的文本描述来定义 UML 图。这种文本描述包括类、对象、关系、注释等元素。

图形输出： PlantUML 可以生成各种图形格式，如 PNG、SVG、PDF 等，这使得 UML 图易于分享和嵌入到文档中。

支持多种图形类型： 不仅仅局限于类图，PlantUML 支持众多 UML 图形，包括时序图、用例图、活动图、组件图等。

跨平台： PlantUML 是基于 Java 的，因此可以在几乎所有平台上运行，包括 Windows、Linux 和 macOS。

集成性： PlantUML 可以与各种文本编辑器和集成开发环境（IDE）配合使用，如 VSCode、Eclipse 等。

以下是一个简单的 PlantUML 示例，表示一个简单的类图：

```markdown
plantuml
Copy code
@startuml
class Car {

- make: String
- model: String

* start()
* stop()
  }

class Engine {

- horsepower: int

* start()
* stop()
  }

Car \*- Engine : has

@enduml
```

展示成这样子

![uml](https://www.plantuml.com/plantuml/png/Iyv9B2vMS4uiKgZcuj9Lo4tCJhLI22ufoinB1t7pKr9pu7mkBONYaiIY4WrDC2k_0CXGKAZbuae66-AQbvwPbmen9oE_g3Yr8ByyjSXA8JEl1BTMaCrQkZ2zLWePYSK0)

这个例子描述了一个简单的类图，其中有一个 Car 类和一个 Engine 类，它们之间存在关系。PlantUML 解释这个描述并生成相应的图形表示，显示类之间的关系和属性。

总体而言，PlantUML 提供了一种方便的方式来创建和共享 UML 图，使开发人员能够更专注于设计而不必花费太多时间在手工绘制图形上。

## PlantUML 使用的环境部署

1. 安装配置 JDK 环境 `brew search java && brew install java`

2. 安装 graphviz 插件 `brew install graphviz`

3. 在 IDE 或者 VSCode 中查看

   - [「VSCode 插件」 PlantUML](https://marketplace.visualstudio.com/items?itemName=jebbs.plantuml)

   - [「JetBrains 插件」 PlantUML Integration](https://plugins.jetbrains.com/plugin/7017-plantuml-integration)
