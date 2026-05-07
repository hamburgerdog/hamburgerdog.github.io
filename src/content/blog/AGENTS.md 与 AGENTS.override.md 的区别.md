---
title: 'AGENTS.md 与 AGENTS.override.md 的区别'
date: 2026-05-07 15:00:00 +0800
tags: Ai算法
subtitle: 'Codex 项目说明文件的加载与覆盖'
remark: '介绍 Codex 中 AGENTS.md 与 AGENTS.override.md 的区别，包括文件命名、加载顺序、同级覆盖、嵌套目录优先级，以及在项目中应该如何使用这两类 agent 指令文件。'
---

# AGENTS.md 与 AGENTS.override.md 的区别

> 先纠正一个很容易写错的点：文件名是 `AGENTS.md` 和 `AGENTS.override.md`，不是 `AGENT.md` 和 `AGENT.override.md`。
>
> 多出来的这个 `S` 看起来不重要，但对 Codex 来说就是文件发现规则的一部分。文件名写错了，它就不会作为项目说明文件被默认读取。

## 先看结论

`AGENTS.md` 是常规说明文件，用来告诉 Codex 当前项目的工作方式、目录结构、测试命令、代码风格和注意事项。

`AGENTS.override.md` 是覆盖说明文件。它的核心作用不是「补充一点规则」，而是在**同一个目录层级**优先于 `AGENTS.md` 被读取。换句话说，如果某个目录下同时存在：

```txt
AGENTS.md
AGENTS.override.md
```

Codex 会优先选择 `AGENTS.override.md`，这个目录下的 `AGENTS.md` 会被忽略。

这就是两者最关键的区别：

| 文件 | 更适合做什么 | 使用频率 |
| --- | --- | --- |
| `AGENTS.md` | 长期稳定的项目说明 | 高频 |
| `AGENTS.override.md` | 临时或局部覆盖规则 | 低频 |

如果用一句话概括：

> `AGENTS.md` 是项目的常规约定，`AGENTS.override.md` 是当前层级的特殊接管。

## Codex 是怎么找这些文件的？

根据 [OpenAI 官方文档](https://developers.openai.com/codex/guides/agents-md)，Codex 在启动时会构建一条指令链（instruction chain）。这里可以把它理解为一条「项目说明链」。

它大致分成三个层面：

1. **全局层面**：默认在 `~/.codex` 下查找说明文件。
2. **项目层面**：从项目根目录开始，一直走到当前工作目录。
3. **合并层面**：从上到下合并说明，越靠近当前工作目录的文件越晚出现，也就越容易覆盖前面的规则。

也就是说，如果你在一个前端仓库的 `packages/admin` 目录下启动 Codex，它看到的可能不是一个文件，而是一串文件：

```txt
~/.codex/AGENTS.md
项目根目录/AGENTS.md
packages/AGENTS.md
packages/admin/AGENTS.md
```

这条链路的价值在于分层：通用规则放全局，项目规则放根目录，模块规则放对应目录。

## 同级优先：override 到底覆盖了什么？

`AGENTS.override.md` 最容易被误解成「覆盖所有上级规则」。实际上，它首先覆盖的是**同一个目录下的普通说明文件**。

例如：

```txt
AGENTS.md
services/
  payments/
    AGENTS.md
    AGENTS.override.md
```

当你在 `services/payments` 下启动 Codex 时，它会读取根目录的 `AGENTS.md`，然后在 `services/payments` 这一层优先选择 `AGENTS.override.md`。

此时，`services/payments/AGENTS.md` 会被忽略，但根目录的 `AGENTS.md` 仍然可能已经进入说明链。

所以更准确的说法是：

- `AGENTS.override.md` 会在同级目录中优先于 `AGENTS.md`；
- 更深层目录的说明会比更浅层目录的说明更晚出现；
- 晚出现的规则在语义上更适合表达局部例外；
- 它不是删除所有上级说明，而是让当前层级进入「特殊规则」。

这个差异很重要。否则你很容易把 `override` 当成一个绝对开关，结果写出一堆彼此冲突的说明文件。

## 什么时候用 AGENTS.md？

大部分时候都应该用 `AGENTS.md`。

例如我们这个博客项目里，根目录的 `AGENTS.md` 就承担了一个入口职责：

```txt
先读 .agents/context/README.md
再按任务类型读取项目总览或写作指南
```

这种信息属于稳定规则，不应该今天变、明天变。

适合写进 `AGENTS.md` 的内容一般有：

- 项目是什么；
- 常用命令是什么；
- 目录职责是什么；
- 哪些文件不要动；
- 修改完成后应该如何验证；
- 内容写作或代码风格有什么约定。

它更像项目里的「新人入职说明」。新人可以看，agent 也可以看。区别只是 agent 更需要明确路径、命令和边界。

## 什么时候用 AGENTS.override.md？

`AGENTS.override.md` 适合处理「当前目录需要特殊接管」的场景。

典型例子：

1. **临时实验**

   你正在一个目录下做迁移实验，希望 Codex 暂时不要遵循原来的构建命令，而是使用新的测试脚本。

2. **高风险模块**

   例如支付、权限、部署脚本这类目录，需要额外强调审批、日志、回滚和安全边界。

3. **团队局部差异**

一个单体仓库（monorepo）里不同团队维护不同模块，根目录约定不够细，某个子目录需要更严格的规则。

4. **个人本地覆盖**

   全局的 `~/.codex/AGENTS.override.md` 可以用于临时覆盖自己的通用偏好。用完就删，不要让它长期存在而忘记。

我不建议把 `AGENTS.override.md` 当成常规说明文件长期使用。它的名字已经说得很直白：override。它应该表达例外，而不是表达默认。

## 一个常见误区：用 override 写补充说明

很多人看到 `override`，第一反应是「我在这里补充一些更细的规则」。这个理解只对了一半。

如果这个目录下没有 `AGENTS.md`，那放一个 `AGENTS.override.md` 当然也能表达当前目录规则。但如果同级已经有 `AGENTS.md`，那它就不是补充关系，而是替代关系。

所以当你的目的只是追加说明时，优先考虑：

- 直接修改同级 `AGENTS.md`；
- 在更深层目录新增一个普通 `AGENTS.md`；
- 把长内容拆到 `.agents/context/`、`docs/` 这类文档中，再由入口文件索引。

只有当你明确知道「这一层的旧说明不该继续生效」时，才考虑 `AGENTS.override.md`。

## 怎么设计一个不容易混乱的规则层级？

我更推荐这样的结构：

```txt
AGENTS.md
.agents/
  context/
    README.md
    project-overview.md
    writing-guide.md
src/
  content/
    AGENTS.md
```

根目录 `AGENTS.md` 只做入口和底线规则，不承载所有细节。

`.agents/context` 放稳定的项目上下文，例如目录说明、写作规范、常见任务入口。

如果某个目录真的有特殊规则，再在对应目录下放 `AGENTS.md`。这样可以做到「越靠近任务，越具体」。

`AGENTS.override.md` 则留给少数场景：

```txt
src/
  content/
    AGENTS.override.md
```

这代表 `src/content` 下的规则不是普通补充，而是一次明确的接管。

## 如何验证它有没有生效？

不要靠感觉。

可以直接让 Codex 说出它当前读取到的说明来源：

```bash
codex --ask-for-approval never "Summarize the current instructions."
```

如果你要验证某个子目录的规则，可以指定工作目录：

```bash
codex --cd src/content --ask-for-approval never "Show which instruction files are active."
```

如果看到的规则不对，优先检查三个点：

1. 文件名是不是 `AGENTS.md` / `AGENTS.override.md`；
2. 当前启动目录是不是你以为的目录；
3. 上级或当前层级是否存在一个更优先的 `AGENTS.override.md`。

这里不要迷信模型自己「应该会读」。对于 agent 来说，说明文件也是输入链路的一部分。输入链路错了，后面做得再聪明也可能跑偏。

## 一句话总结

`AGENTS.md` 是正常秩序，`AGENTS.override.md` 是局部例外。

前者适合长期沉淀项目共识，后者适合临时覆盖或高风险目录接管。真正要做 agent 化，不是把所有规则塞进一个巨大文件，而是把规则按层级拆清楚：全局讲习惯，项目讲边界，目录讲细节，override 只处理例外。

如果一个项目里到处都是 `AGENTS.override.md`，那可能不是规则更强了，而是原来的规则体系已经开始失控了。
