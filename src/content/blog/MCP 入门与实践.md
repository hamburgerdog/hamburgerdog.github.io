---
title: 'MCP 入门与实践'
date: 2025-09-01 15:00:00 +0800
tags: Ai算法
subtitle: 'MCP 入门与实践'
remark: '介绍 MCP（模型上下文协议）的基本概念、核心架构和实践经验，分享内部知识开源经验'
---

# MCP 入门与实践

# **MCP 入门与实践**

> 在公司内部知识开源的一些经验文档分享

## **一、什么是 MCP？**  

**MCP（Model Context Protocol，模型上下文协议）** 是由 Anthropic 公司于 2024 年 11 月推出的开放标准协议，旨在解决大语言模型（LLM）与外部数据源、工具之间的通信难题。它通过**标准化接口**，让 AI 应用像 USB-C 连接设备一样无缝对接本地文件、数据库、API 等资源。  

### **核心架构与价值**  

MCP 采用客户端-服务器架构，包含**三大核心组件**：  

1. **MCP Host**：运行 LLM 的应用程序（如 Claude Desktop、Cursor IDE）；  

2. **MCP Client**：管理服务器连接的中间件，实现权限控制与安全沙箱；
   - 以 cursor 为例，这里指的是内置对 MCP 协议解析和执行的一个引擎  
   - **MCP Service**：轻量级程序，通过协议暴露工具、资源和提示模板。  
   -  [Smithery - Model Context Protocol Registry](https://smithery.ai/)https://smithery.ai/

**其核心价值体现在：**  

- **统一标准**：替代碎片化的 Function Calling 开发，减少 70% 的集成代码量；  

- **安全访问**：通过沙箱机制隔离敏感数据，支持 OAuth 2.0 认证；  

- **生态扩展**：已有上千种 MCP 服务器支持 GitHub、Blender、企业系统等场景。  

 



## **二、MCP 的发展路线**  

### **1. 纯 LLM 时期（2023-2024）**  

早期 LLM 仅能通过文本交互实现问答，例如 GPT-3.5 的聊天机器人形态。其局限在于：  

- **无法访问实时数据**（如股票行情）；  

- **缺乏执行能力**（如发送邮件、生成代码）。  

### **2. LLM + Tools 时期（2024）**  

通过 `Function Calling` 技术，LLM 可调用外部函数，但面临两大瓶颈：  

- **高开发成本**：每个工具需独立编写 JSON Schema 和提示模板；  

- **协议碎片化**：不同厂商的 Function Calling 接口互不兼容。  

典型案例：包括 OpenAI 的 GPTs 和 LangChain 工具链，**生态扩展困难**。  

### **3. LLM + MCP 时期（2025）**  

MCP 的推出标志着 AI 开发进入**协议驱动时代**，其技术突破体现在：  

- **协议标准化**：统一工具描述格式，支持 TS/Python/Java 多语言 SDK；  

- **生态爆发**：截至 2025 年 3 月，GitHub 已有大量开源 MCP 服务器，涵盖文件管理、API 调用、3D 建模等领域；  

- **远程化演进**：2025 年路线图显示，MCP 正加速支持远程服务器托管与无状态操作，向企业级应用迈进。  



 

##  三、**Cursor 中如何使用 MCP**  

> VSCode Client 插件同理

### **环境配置（Windows 示例）**  

1. **安装基础工具**：  
   - Node.js LTS 版本（需通过 CMD 验证 `node --version`）；  [Node.js — 在任何地方运行 JavaScript](https://nodejs.org/zh-cn)https://nodejs.org/zh-cn
   - Cursor IDE 最新版（需开启 MCP 功能支持）[Cursor - The AI Code Editor](https://www.cursor.com/cn) 

2. **添加 MCP 服务器**：  
   
    ```
     # 示例：安装新闻热榜服务器  
    npm install -g @wopal/mcp-server-hotnews  
    ```

### **进阶技巧**  

- **多服务器协同**：可同时配置文件系统、Bilibili API 等服务器，实现跨工具工作流；  

- **调试工具**：通过 `npx -y @modelcontextprotocol/server-debugger` 实时查看协议通信日志；  

- **安全策略**：使用沙箱模式（慎重考虑 YOLO）运行敏感操作，避免直接暴露数据库凭证。  

