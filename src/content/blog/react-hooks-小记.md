---
title: 'React hooks 小记'
date: 2023-12-29 15:30:00 +0800
tags: 编程 前端
subtitle: ''
---

# React hooks 小记

## [useImperativeHandle](https://react.dev/reference/react/useImperativeHandle)

> 通过该 hooks 可以让父组件调用子组件实例的函数

严格要求：只要可以通过 prop 实现的，就不要使用该函数。

用法：

```jsx
import { forwardRef, useRef, useImperativeHandle } from 'react';

const MyInput = forwardRef(function MyInput(props, ref) {
  const inputRef = useRef(null);

  useImperativeHandle(
    ref,
    () => {
      return {
        focus() {
          inputRef.current.focus();
        },
        scrollIntoView() {
          inputRef.current.scrollIntoView();
        },
      };
    },
    [],
  );

  return <input {...props} ref={inputRef} />;
});
```

## [useLayoutEffect](https://zh-hans.react.dev/reference/react/useLayoutEffect)

> useEffect 的同步版本，会在浏览器重绘前可以触发，这样相当于拥有了一层防抖的效果

严格要求：这里的 `callback` 会更新阻塞浏览器重新绘制屏幕的过程，过度使用会导致应用卡顿，需要合理使用。

用法举例：Tooltip 展示

```jsx
//  展示
useLayoutEffect(() => {
  const { height } = ref.current.getBoundingClientRect();
  setTooltipHeight(height);
}, []);
```

- useEffect: 异步执行后续可能会出现高度用更新时的 dom 来计算，导致闪烁；
- useLayoutEffect: 阻塞绘制浏览器重新绘制的过程，先按照 dom 来计算再绘制；

## [useTransition](https://zh-hans.react.dev/reference/react/useTransition)

> 一个帮助开发人员在不阻塞 UI 的情况处理长任务结果的 hook

严格要求：不要在需要同步更新的组件中直接使用。

用法：`const [isPending, startTransition] = useTransition()`

```jsx
const Index: React.FC<any> = () => {
  const [isPending, startTransition] = useTransition();
  const [input, setInput] = useState('');

  return (
    <>
      <Input
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
          startTransition(() => {
            const res: string[] = [];
            for (let i = 0; i < 10000; i++) {
              res.push(e.target.value);
            }
          });
        }}
      />
      {isPending ? <div>加载中...</div> : <span>真实内容</span>}
    </>
  );
};
```

## [useId](https://zh-hans.react.dev/reference/react/useId)

> 生成传递给无障碍属性的唯一 ID。

用法：在数据中没有唯一 ID，但是确实需要一个 ID 的时候可以用。
·

- 指定标签之间的关系；
- [SSR 的流式渲染](https://zh-hans.react.dev/reference/react-dom/server/renderToPipeableStream)，保证客户端和服务器 ID 一致。

```jsx
import { useId } from 'react';

const passwordHintId = useId();

// 如 [aria-describedby](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-describedby)
// 允许你指定两个标签之间的关系
<>
  <input type="password" aria-describedby={passwordHintId} />
  <p id={passwordHintId}>
</>
```

## useUnmountedRef

> 获取当前组件是否已经卸载

实现方法：

```ts
const useUnmountedRef = (): { readonly current: boolean } => {
  const unmontedRef = useRef<boolean>(false);

  useEffect(() => {
    unmontedRef.current = false;
    return () => {
      unmontedRef.current = true;
    };
  });

  return unmontedRef;
};
```

`useRef()` 的作用：能够更新数据但又不触发 React 更新。

## useSafeState

> 实现一个用于异步更新安全的 `useState()` ，即在卸载后的异步回调内部不再执行，避免状态更新导致组件卸载后内存泄漏

实现方法：

```ts
function useSafeState<S>(initialState?: S | (() => S)) {
  const unmountedRef: { current: boolean } = useUnmountedRef();

  const [state, setState] = useState(initialState);
  const setCurrentState = useCallback((currentState: any) => {
    if (unmountedRef.current) return;
    setState(currentState);
  }, []);

  return [state, setCurrentState] as const;
}
```

## useCreation

> 强化 `useMemo()` 和 `useRef()` ，用法了 `useMemo` 一致。一般用于性能优化，其可以保证，值永远最新，而且避免 useRef 隐藏的性能隐患

实现方法：

```ts
const depsAreSame = (oldDeps: DependencyList, deps: DependencyList): boolean => {
  if (oldDeps === deps) return true;

  for (let i = 0; i < oldDeps.length; i++) {
    if (!Object.is(oldDeps[i], deps[i])) return false;
  }

  return true;
};

const useCreation = <T>(fn: () => T, deps: DependencyList) => {
  const { current } = useRef({
    deps,
    obj: undefined as undefined | T,
    initialized: false,
  });

  if (current.initialized === false || !depsAreSame(current.deps, deps)) {
    current.deps = deps;
    current.obj = fn();
    current.initialized = true;
  }

  return current.obj as T;
};
```

## useReactive

> 用法和 `useState()` 一致，但能有效减少定义的 state 数量，提升开发效率。

写法：

```ts
const observer = <T extends Record<string, any>>(initialVal: T, cb: () => void): T => {
  const proxy = new Proxy<T>(initialVal, {
    get(target, key, receiver) {
      const res = Reflect.get(target, key, receiver);
      //  对象的话需要嵌套一个观察，使其成为响应对象
      return typeof res === 'object' ? observer(res, cb) : Reflect.get(target, key);
    },
    set(target, key, val) {
      const ret = Reflect.set(target, key, val);
      cb();
      return ret;
    },
  });

  return proxy;
};

const useReactive = <T extends Record<string, any>>(initialState: T): T => {
  const ref = useLatest<T>(initialState);
  const update = useUpdate();

  const state = useCreation(() => {
    return observer(ref.current, () => {
      update();
    });
  }, []);

  return state;
};

type IRecord = Record<string, any>;

const a: IRecord = {
  '1': 1 as any,
  '2': 1 as any,
  '3': 1 as any,
};
```


