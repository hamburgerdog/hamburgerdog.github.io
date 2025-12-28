// src/components/ScrollReveal.jsx
import { useEffect, useRef, useState } from 'preact/hooks';

import styles from './ScrollReveal.module.less';

export default function ScrollReveal({
  children,
  delay = 0, // 延迟类名
  threshold = 0.1, // 触发阈值（10%进入视野）
  rootMargin = '0px 0px -50px 0px', // 触发区域（底部提前50px触发）
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 如果已经可见，不再重复监听
    if (isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold,
        rootMargin,
      },
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
      observerRef.current = observer;
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [isVisible, elementRef.current, observerRef.current, threshold, rootMargin]);

  return (
    <div
      ref={elementRef}
      className={`${styles['slide-up-init']} ${
        isVisible ? `${styles['slide-up']} ${delay ? `${styles['slide-up-delay-' + delay]}` : ''}` : ''
      }`}
    >
      {children}
    </div>
  );
}
