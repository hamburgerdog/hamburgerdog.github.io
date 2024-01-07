---
title: 'React hooks 小记'
date: 2023-12-29 15:30:00 +0800
tags: 前端
subtitle: '原生以及常用 hooks 分享'
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

//  Record 的作用介绍：
type IRecord = Record<string, any>;

const a: IRecord = {
  '1': 1 as any,
  '2': 1 as any,
  '3': 1 as any,
};
```

## useDebounceFn / useThrottleFn

> 用于处理防抖/节流的 hooks ，通过封装 Lodash 实现

```ts
type noop = (...args: unknown[]) => unknown;

interface ThrottleOptions {
  wait?: number; //  超时时间
  leading?: boolean; //  是否在延迟前执行
  trailing?: boolean; //  是否在延迟后执行
}

interface DebounceOptions extends ThrottleOptions {
  maxWait?: number; //  最大等待时间  （throttle 没有该属性）
}

const useDebounceFn = <T extends noop>(fn: T, options?: DebounceOptions) => {
  const fnRef = useRef(fn);

  //  (...args: Parameters<T>): ReturnType<T>
  //  这里的意思是，入参为一个函数，而出参为该函数的返回值
  const debounceFn = useCreatetion(() =>
    debounce((...args: Parameters<T>): ReturnType<T> => fnRef.current(...args), opetions?.wait ?? 1000, options),
  );

  useUnmount(() => {
    debouceFn.cancel();
  });

  return debounceFn;
};

//  const useThrottleFn =  替换一下 debounce 为 throttle 即可
```

## useDebounce / useThrottle

> 直接返回防抖/节流的更新的值，通常用于 watch 输入框等高频更新的 state

```ts
const useDebounce = <T>(value: T, options?: DebounceOptions) => {
  const [debounced, setDebounced] = useSafeState(value);

  const run = useDebounceFn(() => {
    setDebounced(value);
  }, options);

  useCreation(() => {
    run();
  }, [value]);

  return debounced;
};

//  useThrottle 同理
```

## useLockFn

> 竞态锁，在异步函数执行的时候可以实现阻塞状态，避免并发执行，例如避免重复点击

```ts
const useLockFn = <P extends any[] = any[], V extends any = any>(fn: (...args: P) => Promise<V>) => {
  const lockRef = useRef(false);

  return useCallback(
    async (...args: P) => {
      if (lockRef.current) return;
      lockRef.current = true;
      try {
        const ret = await fn(...args);
        lockRef.current = false;
        return ret;
      } catch (e) {
        lockRef.current = false;
        throw e;
      }
    },
    [fn],
  );
};
```

在组件中的使用方式也很简单，以下在请求期间，click 是无效的：

```jsx
const [count, setCount] = useState(0);

const submit = useLockFn(async () => {
  await mockApiRequest();
  setCount((val) => val + 1);
});

<>
  <p>Submit count: {count}</p>
  <button onClick={submit}>Submit</button>
</>;
```

## useCopy

> 实现一个复制信息的 hooks ，只需要调用 copy 方法就能够将入参保存到剪贴板中。复制过程借用 [copy-to-clipboard](https://github.com/sudodoki/copy-to-clipboard)

```ts
const useCopy = (): [string | undefined, (text: string) => void] => {
  const [copyText, setCopyText] = useSafeState<string | undefined>('');

  const copy = useCallback((value?: string | number) => {
    if (!value) return setCopyText('');
    try {
      copyToClipboard.writeText(value.toString());
      setCopyText(value.toString());
    } catch (error) {
      setCopyText('');
      console.error(error);
    }
  });

  return [copyText, copy];
};
```

## useEventListener

> 实现一个调用 addEventListener 的 hooks，用来监听各类事件。

```ts
const useEventListener = (event: string, handler: (...e: unknown) => void, target?: unknown) => {
  const handlerRef = useRef(handler);

  useEffect(() => {
    // 支持useRef 和 DOM节点
    let targetElement: unknown;
    if (!target) {
      targetElement = window;
    } else if ('current' in target) {
      targetElement = target.current;
    } else {
      targetElement = target;
    }

    //  防止没有 addEventListener 这个属性
    if (!targetElement?.addEventListener) return;

    const useEventListener = (event: Event) => {
      return handlerRef.current(event);
    };
    targetElement.addEventListener(event, useEventListener);
    return () => {
      targetElement.removeEventListener(event, useEventListener);
    };
  }, [event, target]);
};
```
