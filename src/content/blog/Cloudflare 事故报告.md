--- 
title: 'Cloudflare "useEffect" 事故报告'
date: 2025-09-17 12:00:00 +0800
tags: 前端
remark: '分析 Cloudflare 因 useEffect 重复调用导致的自我 DDoS 事故，探讨对象字面量作为依赖项的问题'
---

# Cloudflare “useEffect” 事故报告

最近 Cloudflare 发生了一件 useEffect 重复调用导致的自我 DDoS 事故，接下来我们就简要复现一下。

## 问题案例 

1. 把一个**对象字面量**放到 `useEffect` 的依赖数组中。
2. 该对象每次 render 都是新的引用，effect 会不断触发 fetch，从而在真实后端上快速产生大量请求

```jsx
// BadExample.jsx
import React, { useState, useEffect } from "react";

export default function BadExample({ orgId }) {
  const [tick, setTick] = useState(0);

  // 每次 render 都会创建一个新的对象 literal -> 非稳定引用
  const unstableObj = { org: orgId };

  useEffect(() => {
    // 这个 effect 本应只在 orgId 变化或组件挂载时触发一次
    // 但因为依赖里放了 unstableObj（每次 render 都是新对象），所以会重复运行。
    console.log("useEffect running, tick =", tick);

    fetch("/api/tenant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(unstableObj),
    })
      .then((r) => {
        if (!r.ok) throw new Error("bad resp");
        return r.json();
      })
      .then((data) => console.log("resp", data))
      .catch((err) => console.error("fetch err", err));

    return () => clearTimeout(id);
  }, [unstableObj]); // <-- 问题所在：unstableObj 在每次 render 都是新对象

  return <div>Bad example (check console) — tick: {tick}</div>;
}
```

**为什么它会不断触发？**

* `unstableObj` 是一个对象字面量，每次组件 render 都创建一个新的对象（不同的引用）。React 在比较依赖数组时是按引用比较（shallow compare），因为引用不同，认为依赖发生变化，从而重新 run effect。

<br/>

## 正确写法

- 把稳定的值（`orgId`）直接放入依赖数组
- 把需要的对象通过 `useMemo`/`useCallback` 
- 构造一次性的参数并在 effect 内使用但不要放入依赖数组中（谨慎操作，确保符合语义）。

```jsx
// FixedExample.jsx
import React, { useState, useEffect, useMemo } from "react";

export default function FixedExample({ orgId }) {
  const [tick, setTick] = useState(0);

  // useMemo 保证对象引用在 orgId 不变时稳定
  const stableObj = useMemo(() => ({ org: orgId }), [orgId]);

  useEffect(() => {
    console.log("fixed useEffect running, tick =", tick);
    fetch("/api/tenant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stableObj),
    })
      .then((r) => r.json())
      .then((data) => console.log("resp", data))
      .catch((err) => console.error("fetch err", err));

    const id = setTimeout(() => setTick((t) => t + 1), 1000);
    return () => clearTimeout(id);
  }, [stableObj]); // stableObj 在 orgId 不变时不会改变引用，effect 不会被无谓 re-run

  return <div>Fixed example — tick: {tick}</div>;
}
```

或者更直接与清晰的做法是将原始 primitive（如 `orgId`）直接放进依赖数组，而在 effect 内构建请求体。

