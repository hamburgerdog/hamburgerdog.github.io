---
title: gitlab-ci.yml 常见关键字简介
date: 2025-12-02 15:00:00 +0800
tags: 工程基建
subtitle: 'job、workflow、stage 等关键字简介'
remark: 'GitLab CI/CD 配置文件中 job、workflow、stage、image、script、artifacts、needs、rules、if、when 关键字及其含义，最后总结了 Gitlab Runner 和 Job 的概念对比'
---

# gitlab-ci.yml 常见关键字简介

> 以下是 GitLab CI/CD 配置文件中使用的关键字及其含义：

## 核心结构关键字

**`stages `定义流水线阶段，按顺序执行**：

```yml
stages:
  - build
  - docker
  - test
  - custom
  - deploy
```

**`variables` 定义全局变量，可在所有 job 中使用**：

```yml
variables:
  # 子模块自动拉取，若不需要请注释调
  GIT_SUBMODULE_STRATEGY: recursive
  # 镜像统一推送到 GitLab Registry，必要时可覆盖该变量
  IMAGE: '$CI_REGISTRY_IMAGE/my-coding'
```

**`workflow `控制整个流水线是否运行，在 job 级别之前评估**：

```yml
workflow:
  rules:
    - if: '$CI_PIPELINE_SOURCE == "web" && $CUSTOMIZE_ONLY == "true"'
      when: always
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
      when: always
    - if: '$CI_COMMIT_BRANCH =~ /^(feat\/ci\/.*|master|custom\/.*|release\/.*|hotfix\/.*)$/'
      when: always
    - if: '$CI_COMMIT_TAG'
      when: always
    - when: never
```

## Job 配置关键字

**`stage` 指定 job 所属阶段**：

```yml
my-coding-build:
  stage: build
```

**`image` 指定 job 使用的 Docker 镜像**：

```yml
image:
  name: $CI_REGISTRY/coding/server/server/node:16.13.2
  entrypoint: ['']
```

**`stages`定义流水线阶段，按顺序执行**：

```yml
tags:
  - public-docker
```

**`script` job 执行的命令列表**：

```yml
  script:
    - set -eo pipefail
    - npm i -g n
    - export N_NODE_MIRROR=https://mirrors.huaweicloud.com/nodejs/
    - n 16.18.1
    - npm i -g pnpm@8.8.0
    - pnpm config set store-dir /root/.pnpm-store
    - pnpm config set cache-dir /root/.npm
    - pnpm i --no-frozen-lockfile
    - CI=false pnpm run build-coding
```

**`artifacts` 定义构建产物**：

```yml
  artifacts:
    paths:
      - dist/
      - build/
      - reportBuild/
    expire_in: 3 days
```

**`needs` 定义 job 依赖，允许并行执行**：

```yml
  needs:
    - job: my-coding-build
      artifacts: true
```

**`artifacts`**：是否下载依赖 job 的产物（`true`/`false`）。

## 条件控制关键字

**`rules` 定义 job 执行规则（按顺序匹配，第一个匹配的规则生效）**：

```yml
  rules:
    - if: '$CUSTOMIZE_ONLY == "true"'
      when: never
    - if: '$CI_COMMIT_BRANCH =~ /^release\/3\..*/'
    - when: never
```

**`if`条件表达式，支持**：

- 变量比较：`$VAR == "value"`
- 正则匹配：`$VAR =~ /pattern/`
- 逻辑运算：`&&`、`||`

**`when`执行时机**：

- `on_success`（默认）：前置 job 成功时执行
- `always`：总是执行
- `never`：不执行
- `manual`：手动触发
- `on_failure`：前置 job 失败时执行
- `delayed`：延迟执行

## 内置变量

**Gitlab ci 的部分内置变量：**

- `$CI_REGISTRY`：GitLab Registry 地址
- `$CI_REGISTRY_USER`：Registry 用户名
- `$CI_JOB_TOKEN`：job token
- `$CI_COMMIT_BRANCH`：提交分支
- `$CI_COMMIT_TAG`：提交 tag
- `$CI_PIPELINE_SOURCE`：流水线触发源
- `$CI_REGISTRY_IMAGE`：项目镜像路径
- `$CI_API_V4_URL`：GitLab API v4 地址

## 关键字总结表

| 关键字      | 作用域       | 说明                   |
| ----------- | ------------ | ---------------------- |
| `stages`    | 全局         | 定义流水线阶段顺序     |
| `variables` | 全局         | 定义全局变量           |
| `workflow`  | 全局         | 控制整个流水线是否运行 |
| `stage`     | job          | 指定 job 所属阶段      |
| `image`     | job          | 指定 Docker 镜像       |
| `tags`      | job          | 指定 runner 标签       |
| `script`    | job          | 执行的命令             |
| `artifacts` | job          | 定义构建产物           |
| `needs`     | job          | 定义 job 依赖关系      |
| `rules`     | job/workflow | 定义执行规则           |
| `if`        | rules        | 条件判断               |
| `when`      | rules        | 执行时机               |

这些关键字共同构成了 GitLab CI/CD 的配置结构，用于控制流水线的执行流程。

## 概念理解

### Gitlab Runner

**Gitlab Runner 是一个执行 CI/CD 流水线的应用程序**，是在 Gitlab 应用实例上注册的，可以视为一个构建机器，其类型可以有这几种：Shell、Docker、Kubernetes、SSH、VirtualBox/Parallels。

**主要负责以下工作：**

- 从 GitLab 接收作业
- 在特定环境中执行这些作业
- 将执行结果返回给 GitLab

### Job 任务

**job 是 CI/CD 流水线中的最小执行单位**

- 要执行的脚本

- 运行环境配置

- 执行条件和依赖关系

### 两者对比

| 特性         | GitLab Runner              | Job                       |
| ------------ | -------------------------- | ------------------------- |
| **角色**     | 执行器                     | 任务+工作单元             |
| **数量**     | 一个项目可以有多个 Runners | 一个流水线可以有多个 Jobs |
| **配置位置** | Runner 服务器上注册        | 项目中的 `.gitlab-ci.yml` |
| **生命周期** | 长期运行的服务             | 临时执行的任务            |
| **资源**     | 分配计算资源               | 消耗 Runner 资源          |
