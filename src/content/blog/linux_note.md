---
title: 'Linux操作系统原理与应用笔记'
date: 2020-11-08 08:00:00 +0800
tags: 后端
subtitle: '深入理解Linux内核分析的重难点笔记理解'
---

# Linux 操作系统原理与应用笔记

## 第一章 概述

### linux 内核的技术特点

以实用性和效率为出发点，内核设计成==单内核结构==，整体上把内核作为一个大过程来实现，内核其实就函数和数据结构的集合，其与微内核相比可扩展性和可移植性较低，但与微内核不同，在与文件管理、设备驱动、虚拟内存管理、进程管理等其他上层模块之间不需要有较高的通信开销，==模块之间可以直接调用相关的函数==。（整体的概念）

### linux 内核中链表的实现及应用

> ​ 双链表通过前趋和后继两个指针域就可以从两个方向循环双链表，如果打乱前趋后继的依赖关系，就可以构成**“二叉树”**、“循环链表”，设计更多的指针域还可以构成各种复杂的树状数据结构，如果减少一个指针域，还可以进一步设计成**“栈”和“队列”**。

- 链表的定义

  ```c
  struct list_head{
    struct list_head *next,*prev;
  }

  struct my_list{
    void *mydata;
    struct list_head list;
  }
  ```

  特点：list 域隐藏了链表的指针特性，且一个结构中可以有多个 list 域

- **链表的操作**
  链表头初始化操作为：把前趋后继都指向自己，后续添加操作就是形成一个==循环链表==，内核代码`list.h`中定义了两个宏来定义链表头：

  ```c
  #define LIST_HEAD_INIT(name){&(name),&(name)}
  #define LIST_HEAD(name) struct list_head name = LIST_HEAD_INIT(name)
  ```

  添加节点的具体操作

  ```c
  //	链表的添加节点

  /*
  *	静态内联函数 inline说明该函数对编译程序是可见的
  */
  static inline void __list_add(
  	struct list_head *new,
    struct list_head *prev,
    struct list_head *next
  ){
    next->prev=	new;
    new->next	=	next;
    new->prev	=	prev;
    prev->next=	new;
  }

  //	在链表头尾添加节点
  static inline void list_add(struct list_head *new,struct list_head *head){
    __list_add(new,head,head->next);
  }

  //	在链表头节点后插入new节点
  static inline void list_add_tail(struct list_head *new,struct list_head *head){
    __list_add(new,head->prev,head);
  }
  ```

  `__list_add`这个内部函数，可以看成是==在两个节点(prev 节点和 next 节点)中插入一个新的节点==，这个设计十分巧妙，只要对其进行相应的封装就可以实现多种功能，如`list_add`和`list_add_tail` 这两个函数就可看出，一个是在 head 节点和后继节点间插入新节点，一个是在 head 节点和前趋节点间插入，可以用来分别实现**一个栈和一个队列**。

  - _关键字 inline 必须与函数定义体放在一起才能使函数成为内联，inline 函数一般放在头文件中使用_

- **循环链表操作**

  ```c
  //	每次只找出节点在链表中的偏移位置，还需要list_entry来找出节点的起始地址
  #define list_for_each(pos,head)\
  	for(pos=(head)->next; pos!=(head); pos=pos->next)

  /*
  *	(char *)(ptr)-(unsigned long)(&((type *)0)->member)
  *	ptr指向的是某一结构list域的绝对地址，type是某一结构，member是type结构中的某一域
  * __返回值__ type *
  */
  #define list_entry(ptr,type,member)\
  	((type *)((char *)(ptr)-(unsigned long)(&((type *)0)->member)))

  //	安全的遍历节点，在释放节点前先记录下下一个要释放的节点，因为删除节点后
  //	当前被删除的节点的前趋后继是指向内核中两个固定位置的，如果按list_for_each会出错
  #define list_for_each_safe(pos,n,head)\
  	for(pos=(head)->next,n=pos->next; pos!=(head); pos=n,n=pos->next)

  static inline void __list_del(struct list_head *prev,struct list_head *next){
    next->prev=prev;
    prev->next=next;
  }
  static inline void list_del(struct list_head *entry){
    __list_del(entry->prev,entry->next);
    entry->next=LIST_POSTION1;	//	内核地址中的固定地址
    entry->prev=LIST_POSTION2;
  }

  //	具体代码中的应用
  struct numlist{
    int num;
    struct list_head list;
  }
  ...
    struct numlist numhead;
  	INIT_LIST_HEAD(&numhead.list);

    struct numlist *listnode;
  	struct list_head *pos;
  	struct numlist *p;
  	//	遍历节点的操作
  	list_for_each(pos,&numhead.list){
      // 	list(prt,type,member)
      p = list_entry(pos,struct numlist,list);
      printk(... p->num);
    }
  ...
    - - - - - - - - - - - - - - - - - - - - -
  ...
    struct list_head *n;
  	//	删除所有节点的操作
  	list_for_each_safe(pos,n,&numhead.lits){
      list_del(pos);
      p = list_entry(pos,struct numlist,list);
      kfree(p);
    	...
    }
  ...
  ```

  具体分析`list_entry`:把 0 地址转换成 type 类型的指针，获取该结构中 member 域的指针，也就是为了==得到 member 在 type 结构中的偏移量==，而==ptr - member==就得到了 type 结构的起始地址，也就**获得某一节点的起始地址**，可以进一步读出 type 结构中的 data 域和 list 域

  哈希表也是链表的一种衍生，在`list.h`中也有相关实现

<div id="mmf"></div>

## 第二章 内存寻找

### 内存寻址

> 保护模式：这种模式下内存段的范围受到了限制，范围内存时不能直接从段寄存器中获得段的起始地址，而需要经过额外转换和检查（从此不能再随意存取数据段）
>
> 线性地址：指一段连续的、不分段的，范围从 0~4GB 的地址空间，一个线性地址就是线性空间的一个绝对地址

80386 中地址总线和数据总线都是 32 位，寻址能力达到了 4GB，但其为了兼容，还是保留了 16 位的段寄存器，并采用了在段寄存器基础上的方式来构筑保护机制，即寻址方式为：==段选择符：偏移地址（虚拟地址）==->线性地址（使用 MMU 转换）->物理地址，**段寄存器中存放的是段选择符**（简单理解为段描述表的索引）。

16 位的段寄存器是明显不足以确定一个基地址，因此段寄存器里存放的段选择符就要发挥作用了，同时在保护模式下，系统中存放有三种类型的描述符表：GDT、IDT（中断描述符表）、LDT，为了加快读取速度还设计了三个寄存器，通过段选择符加描述符表的地址，就可以取得段描述符。

Linux 为了保持可移植性并不真正地使用分段机制，开发人员巧妙地将所有段的基地址设置成 0，因此所有的进程都共享了 0~4GB 的线性空间，这样“偏移量”就等于了“线性地址”，也就是说**虚拟地址就直接等同于了线性地址**，但这样会让段保护的第一个方法无法发挥作用，且如果线性空间直接映射到物理空间，还会出现进程使用的地址互相覆盖的问题，为此 Linux 使用了分页机制来解决问题。

页对应的是物理内存的块，大小都是 4KB，通常采用两级页表（页目录和页表）的方法来实现线性地址到物理地址的映射，**32 位线性地址**转换成**物理地址**的处理方式为：

1. 最高 10 位为页目录项的索引，其左移两位后与 CR3 中的页目录基地址相加可以得到对应的页目录项地址
2. 中间 10 位为页表项的索引，其左移两位后与从页目录项得到的页表基址相加得到具体的页表项
3. 最低 12 位为页面偏移地址，从页表项中映射到页面的物理基址，与偏移地址相加就可得到要找的物理地址

### Linux 具体实现内存寻址的方式

目前很多平台都开始使用 64 位的处理器，Linux 为了兼容使用了三级页表的机制，但当前讨论还是通过二级页表的模式为主，其三级页表具体设计为：线性地址（总目录：中间目录：页表：偏移量）。仅支持二级页表的处理器上使用三级页表的模式时，Linux 把中间目录当成只有一项，并把其“折叠”到总目录之中，从而适应了二级页表的机制。

Linux 中每一个进程都有自己的页目录和页表集，当进程发生切换时，**Linux 把 CR3 的内容存放到前一个执行进程的 PCB 中**，而把下一个要执行的进程的 PCB 的值装入到 CR3 中，恢复进程的时候，Linux 会先查找 PCB 中的暂存的内容并恢复到 CR3 中，从而使分页单元指向正确的页表

**linux 内核初始化页表的代码实现**

```c
#define NR_PGT 0x4   												//  需要初始化的页面个数
#define PGD_BASE (unsigned int *)0x1000     //  页目录表映射到物理内存的地址
#define PAGE_OFFSET (unsigned int)0x2000    //	页表的起始地址

#define PTE_PRE 0x01    // 初始化时 页表会装入内存
#define PTE_RW  0x02    // 与U/S位形成硬件保护
#define PTE_USR 0x04    // Page Write-Through 写透方式

void page_init(){
    int pages = NR_PGT; 										//  系统初始化时创建4个页表
    unsigned int page_offset = PAGE_OFFSET;
    unsigned int * pgd = PGD_BASE;          //  页目录表存放的物理地址
    while (pages--)
    {
        * pgd++ = page_offset |PTE_USR|PTE_RW|PTE_PRE;  //  创建四个页目录表项
        page_offset += 0x1000   												//  每个页目录表的大小为2^12=4KB
    }
    pgd = PGD_BASE;

    //  页表从物理内存第三个页框开始
    unsigned int *pgt_entry = (unsigned int *)0x2000;
    unsigned int phy_add = 0x0000;
    //  0x1000000=16MB 初始化了四个页表，每个页表映射了4MB的物理内存地址
    while (phy_add < 0x1000000)
    {
        * pgt_entry = phy_add |PTE_USR|PTE_RW|PTE_PRE;  //  页面与物理内存真正形成映射
        phy_add += 0x1000;      												//  物理块大小和页面大小都是4KB
    }

    //  CR0最高位为控制分页位，linux下分页机制的开启是可选的，则段内嵌汇编的作用就是允许分页
    __asm__ __volatile__("movl  %0, %%cr3;"
                                "movl   %%cr0, %%eax;"
                                "orl    $0x80000000, %%eax;"
                                "movl   %%eax, %%cr0;"::"r"(pgd):"memory","%eax");

}
```

<div id="proc"></div>

## 第三章 进程

### linux 系统中的进程控制块

linux 中对进程的描述结构叫做 PCB（task_struct）其是一个相当庞大的结构体，按功能可以分成以下几类

1. 状态信息-描述进程的动态变化
2. 链接信息-描述进的亲属关系
3. 各种标识符
4. 进程间通信信息
5. 时间和定时器信息
6. 调度信息
7. 文件系统信息
8. 虚拟内存信息-描述进程编译连接后形成的地址空间
9. 处理器环境信息-进程的执行环境（处理器的各种寄存器及堆栈信息），==体现进程动态变化最主要的场景==

系统创建一个新进程的时候就是在内核中为它建立了一个 PCB，进程结束的时候又收回 PCB，其是内核中频繁读写的数据结构，因此应当常驻内存。

每当进程从用户态进入内核态后都要使用栈-进程的内核栈，进程一进入内核态，CPU 就自动为其设置该进程的内核栈，这个栈位于**内核的数据段**上，其==_内核栈和一个`thread_info`结构存放在一起，大小为 8KB_==。实际上内核为 PCB 分配空间的方式是动态的（**确切地说，内核根本不为 PCB 分配内存**），而仅仅给内核栈分配 8KB 的内存，并把一部分让给 PCB 使用(thread_info)。

段起始于末端，并朝这个内存区开始的方向增长，从用户态转到内核态以后，<u>进程的内核栈总是空的</u>，堆栈寄存器 ESP 直接指向内存区的顶端，只要把数据写入栈中，ESP 的值递减。`thread_info`与内核栈存放在一起的最大好处是，内存栈很容易从`ESP`的值获取到当前 CPU 上运行的`thread_info`结构的地址，因为`thread_union`(内核栈和 thread_info)结构的长度是 8KB，**则内核屏蔽 ESP 的低 13 位就得到 thread_info 结构的基地址**，通过`*task`就可以得到该进程的 PCB，`PCB`和`thread_info`都有一个域是指向对方的，是一种一一对应的关系，而再定义一个`thread_info`结构的原因有两种可能：1.该结构是最频繁被调用的 2.随着 linux 版本的变化，PCB 越来越大，为了节省内核栈的空间，需要把一部分的 PCB 内容移出内核栈，只保留最频繁被使用的`thread_info`

### linux 中进程的组织方式

内核建立了几个进程链表，双向循环链表的头尾都是`init_task`（0 号进程的 PCB，是预先由编译器静态分配到内核数据段的，在运行过程中保持不变，永远不会被撤销的），系统使用哈希表和链地址法来加速用 PID 找到相应 PCB 的过程，并组织好了一个就绪队列和等待队列

- 就绪队列存放处于就绪态和运行态的进程

- 等待队列存放睡眠进程，对中断处理、进程同步和定时用处很大

  ```c
  //	等待队列的数据结构
  struct __wait_queue{
    unsigned init flages;	//	区分互斥进程和非互斥进程，对于互斥进程值为（WQ_FLAG_EXCLUSIVE）
    #define WQ_FLAG_EXCLUSIVE 	0x01
    void * private;							//	传递给func的参数
    wait_queue_func_t func;			//	用于唤醒进程的函数，需要根据等待的原因归类
    struct list_head task_list;	//	用于组成等待队列
  };
  typedef struct __wait_queue wait_queue_t;

  //	等待队列头结构
  /*
  *	等待队列是由中断处理程序和主要内核函数修改的,因此必须对其双向链表保护,以免对其进行同时访问
  *	所以采用了自旋锁来进行同步
  */
  struct __wait_queue_head{
    spinlock_t lock;
    struct list_head task_list;
  }
  ```

  等待队列是由中断处理程序和主要内核函数修改的，因此必须对其双向链表保护，以免对其进行同时访问，所以采用了自旋锁来进行同步

  等待队列的操作`add_wait_queue()`把一个非互斥进程插入到等待队列链表的第一个位置，`add_wait_queue_exclusive()`把一个互斥进程插入但等待队列的最后一个位置。让某一个进程去睡眠的最基本操作为：先把当前进程的状态设置成`TASK_UNINTERRUPTIBLE`并把它插入到特定的等待队列中，然后调用调度程序，当进程被唤醒的时候会接着执行剩余的指令，同时把进程从等待队列中删除

  ```c
  //	wake_up()函数
  void wake_up(wait_queue_head_t){
    struct list_head *tmp;
    wait_queue_t *curr;
    //	扫描链表，找等待队列中的所有进程
    list_for_each(tmp,&q->task_list){
      //	curr指向每个等待进程的起始地址
      curr=list_entry(tmp,wait_queue_t,task_list);
      /*如果进程已经被唤醒并且进程是互斥的，则循环结束
       *因为所有的非互斥进程都是在链表的开始位置，而所有的互斥进程都在链表的尾部，所以可以先唤醒非互斥			 *进程再唤醒互斥进程
       */
      if(curr->func(curr,TASK_INTERRUPTIBLE|TASK_UNINTERRUPTIBLE,0,NULL)&&curr->flags)
        break;
    }
  }
  ```

### linux 进程调度

linux 进程调度是时机：

    1. 进程状态转换的时刻，使用`sleep_on()`、`exit()`时会主动调用调度函数
    2. 当前进程的时间片用完
    3. 设备驱动程序运行时
    4. 从内核态返回到用户态时，从系统调用返回意味着离开内核态，状态转换需要花费一定的时间，在返回到用户态前，系统把在内核态该处理的事应当全部做完。

```c
//	schedule() 函数主框架
static void __sched notrace __schedule(bool preempt)
{
    struct task_struct *prev, *next;
    unsigned long *switch_count;
    struct rq *rq;
    int cpu;

    /*  ==1==
        找到当前cpu上的就绪队列rq
        并将正在运行的进程curr保存到prev中  */
    cpu = smp_processor_id();
    rq = cpu_rq(cpu);
    prev = rq->curr;

    /*
     * do_exit() calls schedule() with preemption disabled as an exception;
     * however we must fix that up, otherwise the next task will see an
     * inconsistent (higher) preempt count.
     *
     * It also avoids the below schedule_debug() test from complaining
     * about this.
     */
    if (unlikely(prev->state == TASK_DEAD))
        preempt_enable_no_resched_notrace();

    /*  如果禁止内核抢占，而又调用了cond_resched就会出错
     *  这里就是用来捕获该错误的  */
    schedule_debug(prev);

    if (sched_feat(HRTICK))
        hrtick_clear(rq);

    /*  关闭本地中断  */
    local_irq_disable();

    /*  更新全局状态，
     *  标识当前CPU发生上下文的切换  */
    rcu_note_context_switch();

    /*
     * Make sure that signal_pending_state()->signal_pending() below
     * can't be reordered with __set_current_state(TASK_INTERRUPTIBLE)
     * done by the caller to avoid the race with signal_wake_up().
     */
    smp_mb__before_spinlock();
    /*  锁住该队列  */
    raw_spin_lock(&rq->lock);
    lockdep_pin_lock(&rq->lock);

    rq->clock_skip_update <<= 1; /* promote REQ to ACT */

    /*  切换次数记录, 默认认为非主动调度计数(抢占)  */
    switch_count = &prev->nivcsw;

    /*
     *  scheduler检查prev的状态state和内核抢占表示
     *  如果prev是不可运行的, 并且在内核态没有被抢占
     *
     *  此时当前进程不是处于运行态, 并且不是被抢占
     *  此时不能只检查抢占计数
     *  因为可能某个进程(如网卡轮询)直接调用了schedule
     *  如果不判断prev->stat就可能误认为task进程为RUNNING状态
     *  到达这里，有两种可能，一种是主动schedule, 另外一种是被抢占
     *  被抢占有两种情况, 一种是时间片到点, 一种是时间片没到点
     *  时间片到点后, 主要是置当前进程的need_resched标志
     *  接下来在时钟中断结束后, 会preempt_schedule_irq抢占调度
     *
     *  那么我们正常应该做的是应该将进程prev从就绪队列rq中删除,
     *  但是如果当前进程prev有非阻塞等待信号,
     *  并且它的状态是TASK_INTERRUPTIBLE
     *  我们就不应该从就绪队列总删除它
     *  而是配置其状态为TASK_RUNNING, 并且把他留在rq中

    /*  如果内核态没有被抢占, 并且内核抢占有效
        即是否同时满足以下条件：
        1  该进程处于停止状态
        2  该进程没有在内核态被抢占 */
    if (!preempt && prev->state)
    {

        /*  如果当前进程有非阻塞等待信号，并且它的状态是TASK_INTERRUPTIBLE  */
        if (unlikely(signal_pending_state(prev->state, prev)))
        {
            /*  将当前进程的状态设为：TASK_RUNNING  */
            prev->state = TASK_RUNNING;
        }
        else   /*  否则需要将prev进程从就绪队列中删除*/
        {
            /*  将当前进程从runqueue(运行队列)中删除  */
            deactivate_task(rq, prev, DEQUEUE_SLEEP);

            /*  标识当前进程不在runqueue中  */
            prev->on_rq = 0;

            /*
             * If a worker went to sleep, notify and ask workqueue
             * whether it wants to wake up a task to maintain
             * concurrency.
             */
            if (prev->flags & PF_WQ_WORKER) {
                struct task_struct *to_wakeup;

                to_wakeup = wq_worker_sleeping(prev);
                if (to_wakeup)
                    try_to_wake_up_local(to_wakeup);
            }
        }
        /*  如果不是被抢占的，就累加主动切换次数  */
        switch_count = &prev->nvcsw;
    }

    /*  如果prev进程仍然在就绪队列上没有被删除  */
    if (task_on_rq_queued(prev))
        update_rq_clock(rq);  /*  跟新就绪队列的时钟  */

    /*  挑选一个优先级最高的任务将其排进队列  */
    next = pick_next_task(rq, prev);
    /*  清除pre的TIF_NEED_RESCHED标志  */
    clear_tsk_need_resched(prev);
    /*  清楚内核抢占标识  */
    clear_preempt_need_resched();

    rq->clock_skip_update = 0;

    /*  如果prev和next非同一个进程  */
    if (likely(prev != next))
    {
        rq->nr_switches++;  /*  队列切换次数更新  */
        rq->curr = next;    /*  将next标记为队列的curr进程  */
        ++*switch_count;    /* 进程切换次数更新  */

        trace_sched_switch(preempt, prev, next);
        /*  进程之间上下文切换    */
        rq = context_switch(rq, prev, next); /* unlocks the rq */
    }
    else    /*  如果prev和next为同一进程，则不进行进程切换  */
    {
        lockdep_unpin_lock(&rq->lock);
        raw_spin_unlock_irq(&rq->lock);
    }

    balance_callback(rq);
}
STACK_FRAME_NON_STANDARD(__schedule); /* switch_to() */

/*转载自： http://blog.csdn.net/gatieme*/

/* 进程地址空间切换详解 */
kstat.context_swtch++;	//	统计上下文切换的次数
{
  struct mm_struct *mm = next -> mm;
  struct mm_struct *oldmm = prev -> active_mm;
  if(!mm){		//	没有用户空间，表明这为内核线程
    if(next->active_mm==NULL)BUG();
    nexit->active_mm=oldmm;
  }else{			//	一般进程则切换到这段用户空间
    if(next->active_mm!=mm)BUG();
    switch_mm(oldmm,mm,next,this_cpu);
  }
  if(!prev->mm){		//	切换出去的是内核线程的处理方式
    prev->active_mm=NULL;
    mmdrop(oldmm);
  }
}

```

Linux schedule()分析：

1. 进程需要有自己的地址空间，或者和其他进程借用，如果都没有则出错，且如果`schedule()`在中断服务程序内部执行也出错
2. 对当前进程要做相关的处理，应当进入调度程序是，其状态不一定还是`TASK_RUNNNING`
3. 进程地址空间切换，如果新进程有自己的用户空间，则`switch_mm()`函数会把该进程从内核空间转换到用户空间（加载下一个要执行的进程的页目录）；如果新进程是一个内核线程，无用户空间而在内核空间中运行，则要借用前一个进程的地址空间，因为所有的进程的内核空间都是共享的。如果切换出去的如果是内核线程，则要归还所借用的地址空间，并把 mm_struct 中的共享计数减 1

### Linux 进程创建、线程及其创建

Linux 创建进程的方式是通过`fork()`或者`clone()`，然后再调用`exec()`，其使用的是写时复制技术（把父子进程的全部资源都设为只读，在父子进程尝试对其进行修改时才将被修改前的全部资源复制给子进程），创建进程的实际花销是为其创建 PCB 并把父进程的页表拷贝一份，如果进程中包含线程，则所有线程共享这些资源，无须拷贝。子进程一开始处于深度睡眠态，以确保它不会立刻运行，在把进程 PCB 插入到进程链表和哈希表后才将其设成就绪态，并让其平分父进程剩余的时间片，内核有意让子进程先执行，是为了让子进程使用`exec()`去执行其自己的代码，避免父进程操作引起写时复制，提高系统运行速度

Linux 把线程看成一个使用某些共享资源的进程，每个线程有唯一的 PCB，一般情况下内核线程会在创建时永远地执行下去，在需要的时候就会被唤醒和执行。

1. 进程 0：内核初始化工作的`start_kernel()`创建一个内核线程也就是进程 0，其 PCB 就是`init_task`
2. 进程 1：也就是 init 进程，其一开始是一个内核线程，其调用了`execve()`装入了用户态下可执行程序 init(/sbin/init)，因此 init 是内核线程启动起来的一个普通进程，也就是用户态下的第一个进程

<div id="mm"></div>

## 第四章 内存管理

32 位平台线性空间固定大小为 4GB，其中高地址 1GB（0xC000 0000~0xffff ffff）是内核空间，被内核使用并且由所有进程共享，每个用户进程的用户空间为 3GB 大小，通过分页机制实现各个进程的用户空间私有。

进程页目录 PGB 就位于内核空间中，在切换进程的时候需要将 CR3 指向新进程的 PGB，CR3 需要物理地址，而 PGB 在内核中的起始地址是虚地址，这时候需要转换，Linux 的内核空间有一个独特设计，即==内核空间连续地占据了每个虚拟空间中最高的 1GB，映射到物理内存却总是从最低地址开始的==，因此内核地址到物理地址只需要减去`PAGE_OFFSET`就可以了。

内核地址空间的结构：内核的代码和数据叫做内核映像，Linux 内核映像存放于 0x0010 0000 开始的地方

1. 这前 1M 的空间用于存放于系统硬件相关的代码和数据
2. 内核映像占用 0x10 0000 到 start_mem 的空间
3. Start_mem 到 end_mem 这段区域叫做动态内存，是用户程序和数据使用的内存区

### 进程的用户空间管理

用户地址空间的结构：用户程序经过编译和链接后形成二进制映像文件，数据段、代码段、堆栈使用的空间都是在建立进程的时候就分配好，都属于必需的基本要求

1. 堆栈段：在用户空间顶部，由顶向下延伸
2. BSS：动态分配的空间
3. 数据段：静态分配的数据空间，
4. 代码段：程序的相关代码

每个进程只有一个`mm_struct`，其是对整个用户空间的描述，而一个进程的虚拟空间中可能有多个虚拟区间，用`vm_area_struct`描述，如堆栈段、数据段......

- `mm_struct` 在 `task_struct` 可以找到指向该结构的指针，虽然每个进程只有一个虚拟地址空间，但是该空间可以被其他进程所共享，因此需要使用原子类型的操作 `atomic_t`(该结构中包含了一个计数器)，**描述了代码段、数据段、参数段已经环境段的起始地址和结束地址**，==还有指针 pgt 指向该进程的页目录==

  > **_进程页表和内核页表的区别_** - [Linux 内核页表和进程页表](https://blog.csdn.net/chuba6693/article/details/100612637)
  >
  > - 在保护模式下，**从硬件角度看，其运行的基本对象为“进程”(或线程)，而寻址则依赖于“进程页表”**，在进程调度而进行上下文切换时，会进行页表的切换：即将新进程的 pgd(页目录)加载到 CR3 寄存器中。
  > - **进程页表中的线性地址包括两个部分：用户态和内核态**，内核态地址对应的相关页表项，对于所有进程来说都是相同的(因为**内核空间对所有进程来说都是共享的**)，而这部分页表内容其实就来源于“内核页表”，即每个进程的“进程页表”中内核态地址相关的页表项都是“内核页表”的一个拷贝。
  > - **内核页表也包括两个部分：线性映射区和 vmalloc 区**，“内核页表”由内核自己维护并更新，在`vmalloc区`发生`page fault`时，将“内核页表”同步到“进程页表”中。
  > - 以`vmalloc`为例(最常使用)，这部分区域对应的线性地址在内核使用`vmalloc`分配内存时，其实就已经分配了相应的物理内存，并做了相应的映射，建立了相应的页表项，但**相关页表项仅写入了“内核页表”，并没有实时更新到“进程页表中”，内核在这里使用了“延迟更新”的策略**，将“进程页表”真正更新推迟到第一次访问相关线性地址，发生`page fault`时，此时在`page fault`的处理流程中进行“进程页表”的更新。

- `vm_area_struct` Linux 把虚存区看成是对象，把用户空间划分成一段一段是因为每个虚存区的来源可能不同，有的来自可执行映像，有的来自共享库、动态分配的内存区，不同的区有不同的操作权限和操作方法；`vm_area_struct` 可用双向链表和红黑树来组织，有利于快速定位虚存区

创建进程的时候，进程用户空间的创建依赖于父进程，所做的工作仅仅是`mm_struct`和`vm_area_struct`的创建以及页目录和页表的建立，采用**写时复制**的方法。Linux 并不把进程的可执行映像装入物理内存，只是把它们链接到进程的用户空间，被引用的程序部分会由操作系统装入物理内存，也就是需要使用请页机制

### 请页机制

给进程分配新物理页面的确定方式：

1. 如果页面不在内存中，页没有被调入，则内核分配一个新页面并初始化，“请求调页”
2. 如果页面在内存但是只读，则内核分配一个新页面并复制旧页面的内容，“写时复制”

- _请求调页：写处理，获取新页面，把页面填为 0，把页表置为新页面的物理地址，并设页面为可写和脏；读处理，分配一个零页，零页在内核初始化期间被静态分配并标记为不可写，当进程写该页面的时候才使用写时复制_

### 物理内存

内核用`struct page`结构表示系统中的每一个物理页面，也叫页描述符，这种结构目的在于描述物理内存本身，内核仅用这个数据结构来描述当前时刻在相关物理页中存放的东西。

**伙伴算法**：Linux 把空闲页面分为 10 块链表，每个链表中的一个块为 2 的幂次个页面，

```c
	struct free_area_struct{
    struct page *next;		//	用于将page链接成一个双向链表
    struct page *prev;
    unsigned int *map;		//	map指向一个位图
  }free_area[10];
```

算法过程：如果要求分配的块大小为 128 个页面，则去块大小为 128 的链表中找，如果没有则往上找，如果 256 大小的链表中有空间，则把 256 个页面平分，高地址的被使用，低地址的加入 128 的链表中，回收过程则相反，同时要注意相邻的物理页面要进行合并

Linux 中有`freepages`结构，来使用内核交换守护进程(`kswapd`)保证系统有足够的物理内存，结构中有`min|low|high`三条线，各个界限值是通过实际的物理内存大小计算出来的，少于 low 会开启强交换；少于 high 会启动后台交换；高于 high 则什么都不做。

**Slab 分配机制**：用于解决内碎片，减少对伙伴算法的调用次数。对于预期频繁使用的内存区可以创建特定大小的专业缓冲区来处理，使用较少的内存区创建通用缓冲区来处理。

- slab 缓冲区由一连串的大块 slab 构成，每个大块中包含了若干个同类型的对象，实际上缓冲区是内存中的一片区域，这片区域划分为多个 slab 块，每个 slab 由一个或者多个页面组成，存放的都是同一类型的对象
- 通用缓冲区，通用缓冲区最小的为 32B、64B.....128KB，对通用缓冲区的管理依旧是 slab 方式

> `kmalloc()`用于分配内核中的连续内存 | `vmalloc()`用于分配非连续的内核内存

### 回收机制

把页面换出推迟到无法推迟为止，换出页面的时候不需要先将内容写入到磁盘中，如果一个页面从最近一次换入后并没有被写过则它是干净的，可以一直缓冲到必要时才加以回收；写过的脏页面放到磁盘交换区中，但不立即释放，一直推迟到必要时才进行，如果一个页面在释放后又被访问，则重新从磁盘缓冲区读入即可

内核守护线程`kswapd`是有自己的 PCB，一样受到内核的调度，由内核设计时规定多久运行一次，

<div id="intr"></div>

## 第五章 中断和异常

> 异常：1. 故障 2. 陷阱
> 中断：1.可屏蔽中断（外部，IRQ） 2.非屏蔽中断（计算机内部的硬件故障-缺页）
>
> 通常我们指的**异常**是指*异常和非屏蔽中断*，**中断**特指*可屏蔽的中断*

**Linux 中有 256 个中断向量：**0-31 号对应为异常（异常和非屏蔽中断）向量；32-47 号对应中断向量，可屏蔽中断可以通过对中断控制器的编程来改变；48-255 号对应软中断，Linux 只使用了 128 号中断（int 0x80）来实现系统调用

外设可屏蔽中断，**x86 通过两片 8259A 中断控制器来响应 15 个外中断源**，每个 8259A 可管理 8 个中断源，第二个芯片通过第一个芯片（主片）的 2 号中断线连接，与中断控制器相连的线称为中断线，**申请一条中断线就是申请一个 IRQ 或者申请一个中断号**，IRQ 从 0 开始编号，IRQn 的默认中断向量就是 n+32。

对于外部 I/O 请求的屏蔽可以分成两种

1. CPU 内部关中断，则屏蔽所有外部中断
2. 中断控制器内部的中断控制寄存器，其对应芯片的各条中断线，可以屏蔽特定中断线上的中断

**中断线是可共享的由一个中断处理程序统一处理，而一个中断处理程序又拥有多个对应设备的中断服务例程**

- <u>_异常与外部接口没有任何关系，CPU 执行一个异常处理程序的时候需要关中断，即屏蔽其他异常和中断，**CPU 具有异常锁存的功能**，可以避免异常处理的嵌套，Linux 内核必须针对不同的处理器发布的所有异常提供专门的异常处理程序_</u>

### 中断描述符表

实模式下，0-1KB 的内存空间用来存放中断向量表，表项为段地址和偏移量组成；在保护模式下，4 字节的表项不足以满足需求，此时表项为：2 字节的段地址、4 字节的偏移量和 2 字节反映模式切换的信息，中断向量表也该交为中断描述符表(IDT)，其表项被称为门描述符，中断发生的时候必须先通过这个门再找到相应处理程序。中断描述符表可以存放在内存中任意位置，CPU 中有一个 IDTR 寄存器来找到其位置（48 个字节大小，高 32 位为基地址，低 16 位为 IDT 大小）。

门描述符的类型：

1. 中断门，请求特权级 DPL 为 0，用户不能访问，且访问时需要关中断，避免中断嵌套，所有中断处理程序都由中断门激活，并全部限制在内核态中
2. 陷阱门，用户不能访问，但访问时不需要关中断
3. 系统门，用户态进程可以通过系统门进入内核态，从而访问陷阱门

**IDT 表项的设置：**中断描述符表开头的 19 个陷阱门和系统门，这些中断向量都是被 CPU 保留用来处理异常的，从 32 号开始有 224 个中断门（必须跳过 128 号向量用于系统调用的向量）

### 中断处理

在 CPU 执行下一条指令前需要进行中断检查，看看是否发生了中断或者异常，如果发生了则

1. 确定发生的中断或者异常的向量 i
2. 通过 IDTR 找到 IDT，读取第 i 项
3. 进行有效性检查：
   - “段”级检查，CPU 当前特权级是否比第 i 项段选择符中描述的特权级大，不允许低特权的进程引起高特权级的中断处理程序
   - “门”级检查，CPU 当前特权级是否比第 i 个门的特权级相比，如果小于则 CPU 不能通过，只针对用户程序，而不包括 IO 产生的中断或者 CPU 内部的异常
4. 是否发生了特权级的变化，如果变化了则说明要进行用户态到内核态的堆栈转换

实现共享中断线，需要建立**中断请求队列**，在 Linux 中 15 条中断线对应 15 个中断处理程序，此时 CPU 虽然通过中断门能找到对应的中断处理程序，但是具体的中断服务例程还未进入中断请求队列，因此中断不会被处理

```c
/*中断线共享的数据结构*/
struct irqaction{
  irq_handler_t handler;	//	指向一个具体的中断服务程序
  unsigned long flags;		//	中断线与IO设备的管理，IRQF_SHARED 允许其他设备共享此中断线
  cpumask_t mask;
  const char *name;				//	IO设备名
  void *dev_id;						//	主次设备号
  struct irqaction *next;	//	共享同一中断线的每个硬件对应的中断服务例程
  int irq;
....
}

/*注册中断服务程序*/
int request_irq(unsigned int irq,
               irq_handler_t handler,
               unsigned long irqflags,
               const char *devname,
               void *dev_id)
  //	irq				表示要分配的中断号，可以预先设定或者动态探测
  //	handler		指向处理中断的实际中断服务程序
  //	irqflags	设置中断线可否共享等信息
  //	devname		与中断相关的设备的名字
  //	dev_id		提供唯一的标志信息，以便在删除时能从共享中断线中找到指定的中断服务例程
```

中断服务程序执行时需要关闭中断，因此必须在用来处理最紧迫的事情后就立刻开中断，避免丢失重要的中断，把剩下的事情交由另一部分处理，也就分成了中断服务程序的上下部：

- 中断的上半部处理与设备相关的操作：响应中断请求，读取或发送相关数据，这一部分工作很少

- 中断的下半部处理与程序相关的操作

中断下半部有两种机制：

1. 小任务机制，把要推迟执行的函数进行组织，`tasklet_struct`结构表示一个独立的小任务，小任务不能睡眠，但在运行时能响应中断，推迟要处理的事情由结构中的`tasklet_handler`实现，由小任务封装后交给内核处理，在被调度后尽可能尽早执行
2. 工作队列机制，我们把推后执行的任务称为工作，这些工作以队列结构组成工作队列，而工作者线程（内核线程）就负责执行工作队列中的工作，工作队列机制是允许调度和睡眠的

### 时钟中断

> 时间硬件分为 RTC 和 OS 时钟，RTC 为实时时钟，又称 CMOS 时钟，是 PC 主板上的一块芯片；OS 时钟是操作系统控制的 PC 主板上的定时|计数芯片产生的，在开机时，操作系统取得 RTC 中的时间数据来初始化 OS 时钟，该定时芯片会不断的发送输出脉冲，并连接到中断控制器上，从而不断触发时钟中断，通过时钟中断来维持 OS 时钟的正常工作，即加 1 和细微的修正工作。

OS 时钟和 RTC 时钟通过 BIOS 链接，RTC 是 OS 时钟的基准，Linux 在内核初始化完成后就会抛弃 BIOS

Linux 中为了简化 RTC 时钟到 OS 时钟的运算，将时间基准设为 1970 年 1 月 1 号凌晨 0 点，OS 时间其实就是一个计数器，记录 RTC 时间-时间基准的节拍数，系统实际时间 Xtime 是通过读取 RTC 来初始化的，jiffies 记录从系统启动至今的节拍数

时间中断处理程序

1. 给节拍数 jiffies 加 1
2. 更新资源消耗的时间，如当前进程所消耗的系统时间和用户时间
3. 执行到期定时器
4. 执行调度函数
5. 根据 xtime 时间更新墙上时间
6. 计算平均负载值

<div id="sscl"></div>

## 第六章 系统调用

系统调用是用户进程进入内核的接口层，它本身并非内核函数，但它是由内核函数实现的，进入内核后，不同的系统调用会找到各自对应的内核函数，这些内核函数被称为系统调用的“服务例程”。

用户在调用系统调用的时候回向内核传递一个系统调用号`__NR_XXX N`，然后系统调用处理程序通过这个号从系统调用表中找到相应的内核函数执行。系统调用号是 linux 系统分配的，分配完成后不能有任何改变。

内核建立一个系统调用表，这个表保存在`sys_call_table`数组中，其是一个函数指针数组，每一个函数指针都指向其系统调用的封装例程，有`NR_syscalls`个表现，第 n 个表项包含系统调用号为 n 的服务例程的地址，但`NR_syscalls`只是对可实现的系统调用最大个数进行了限定，并不表示实际已实现的系统调用数。

```c
ENRTY(sys_call_table)
  .long sys_restart_syscall
  .long sys_exit
  .long sys_fork
  .long sys_read
  .long sys_write
  .long sys_open
...
```

应用程序是通过软中断的方式来通知系统的，引发一个异常来促使系统切换到内核态去执行异常处理程序，此时的异常处理程序就是系统调用处理程序。

**`System_call()`函数**

1. 首先把系统调用号和异常处理程序可以用到的 CPU 寄存器都保存到相应的栈中，通过获得内核栈指针的值并把它取整到 8KB 的倍数而获得当前进程的 PCB 地址
2. 对传进来的系统调用号进行检查，如果不小于`NR_syscalls`则系统调用处理程序终止
3. 如果系统调用号无效，则返回用户态，并在 EAX 中存放一个负的返回值
4. 最终，根据 EAX 中包含的系统调用号找到对应的服务例程，因为系统调用表中每一项占 4 字节，故 EAX 中的系统调用号左移两位再加上`sys_call_table`的基址就可以获取到相对应的服务例程

与普通函数的参数通过活动的程序栈传递不同，**系统调用的参数通常是通过寄存器传递给系统调用处理程序的，然后再拷贝到内核堆栈中**，所以参数个数不能超过 6 个且长度不长于 32 位，但通常也确实存在超过 6 个参数的调用，这种情况下，需要用一个单独的寄存器指向进程地址空间中这些参数所在的一个内存区即可

存放系统调用参数所用的 6 个寄存器分别为`EAX、EBX、ECX、EDX、ESI和EDI` `system_call()`通过`SAVE_ALL`宏将其保存到内核态堆栈中。

**封装服务例程**

Linux 定义了`__syscall0`到`__syscall5`这六个宏，0~5 分别对应参数的个数，严格来说每个宏需要 2+2xN 个参数，n 是系统调用所需的参数（类型和名字）2 是系统调用的名字和返回值类型

```c
int write() -> __NR_write -> 4 -> int sys_write() ->
__syscall3(int,write,int,fd,const char*,buf,unsigned int,count)
```

```assembly
write(write的__syscall3宏展开):
	pushl	%ebx						;	传参
	movl	8(%esp)	,	%ebx
	movl	12(%esp),	%ecx
	movl	16(%esp),	%edx
	movl	$4,	%eax				;	系统调用号
	int		$0x80						;	系统调用中断
	cmpl	$-126,	%eax
	jbe		.L1
	negl	%eax
	movl	%eax,	errno
	movl	$-1,	%eax
.L1:	popl %ebx
	ret
```

<div id="sync"></div>

## 第七章 内核中的同步

> ​ 内核中很多数据都是共享资源，对这些共享资源的访问必须遵循一定的访问规则

内核中造成并发并发执行的原因简单来说有以下几种：

1. 中断，中断几乎在任何时刻都可异步发生，也就随时打断当前正在执行的代码
2. 内核抢占
3. 睡眠
4. 对称多处理——两个及以上的处理器可以同时执行代码

如果在一段内核代码访问某资源的时候产生了一个中断，且该中断也要访问同一资源，这就存在一个“潜在的错误”；如果在一段内核代码访问一个共享资源时可以被抢占，也一样存在一个“潜在的错误”，**辨认出真正需要共享的数据和相应的临界区（操作共享资源的代码段）才很有挑战性。**

### 内核同步措施

**原子操作：**保证指令以原子的方式执行，如加法指令把读取和增加放在一个执行指令完成，这样并发任务就不会同时访问同一个变量，绝不会引发竞争。

```c
/*linux内核提供的atomic_t类型*/
typedef struct{
  int counter;
}atomic_t;
```

相关的专门函数和宏:
| 函数 | 说明 |
| --------------- | ------------------------------- |
| ATOMIC_INIT(i) | 声明一个 atomic_t 变量并初始化为 i |
| atomic_read(v) | 返回 *v |
| atomic_set(v,i) | 把*v 置成 i |
| atomic_add(i,v) | 从*v 加 i |
| atomic_sub(i,v) | 从*v 减 i |
| ........... | |

**自旋锁：**单处理器可以简单的关中断实现，自旋锁只能被一个内核任务持有，如果一个任务请求已被持有的锁则会一直忙循环，等待锁重新可用，可以有效避免多处理器并发执行的内核任务竞争共享资源，但自旋锁不应被持有过长，要长时间持有最好使用信号量

**信号量：**即等待队列和睡眠机制，Linux 中有`down()`和`up()`操作，如果信号量不小于 0 则获得信号锁，任务就进入临界区了，如果信号量小于 0 则任务挂入等待队列，信号量会睡眠所以不能再中断上下文中使用，且信号量的数据结构中也用有自旋锁，用于避免多处理器并行的错误

<div id="fs"></div>

## 第八章 文件系统

Linux 主要的目录结构(树状结构)

- /bin 二进制可执行命令
- /dev 设备特殊文件
- /etc 系统管理和配置文件
- /home 用户主目录基点
- /lib 动态链接共享库
- /sbin 系统管理命令
- /tmp 公用的临时文件
- /root 系统管理员的主目录
- /mnt 临时安装其他文件系统的目录
- /proc **虚拟目录，是系统内存的映射，可以直接获取系统信息**
- /var 某些大文件的溢出区
- /usr 应用程序和文件

### linux 文件系统

1. 索引结点：记录文件信息，描述某文件的大小、权限、位置等关键信息，每个文件或者目录都对应一个索引结点，文件系统把所有索引结点形成一个数组，每一个结点的分配的号码就是数组中的索引号
2. 软连接和硬链接
   - 硬链接是一个物理位置，多个文件名，**不能是目录，必须同一个文件系统**；
   - 软连接，即符号链接，存放的内容的指向另一个文件的地址，系统自动把对符号链接的操作变成对源文件的操作
3. 文件系统：Linux 的标准文件系统是 Ext2 和 Ext3，因此==Linux 把 Ext2 文件系统的磁盘分区作为系统的根文件系统==，其他的文件系统都是安装在根文件系统之下

### 虚拟文件系统

> 虚拟文件系统即 VFS（virtual filesystem switch），一种统一的框架用于虚拟文件系统转换

VFS 提供一组标准的、抽象的操作以系统调用的方式给用户使用，如用户使用`read()`读取文件时，会调用`sys_read()`接着又调用`vfs_read()`，文件在内核是由一个`file`结构表示的，里面有一个`file_opration`结构包含指向各种函数的指针，其是由具体的文件系统自己实现的，从而实现封装操作。

VFS 的四个主要对象为:

1. **超级块对象**，是一块包含文件系统信息的数据结构，描述已安装的文件系统
2. 索引结点对象，文件系统对文件属性的描述，索引号可以唯一的标识文件
3. **目录项对象**，目录可以层层嵌套形成文件路径，路径中的每一部分都被称为目录项，如有一个路径为`/home/xj/myfile`，其中/为根目录，home,xj,myfile 都是目录项，是路径的组成部分
4. **文件对象**，目录属于普通文件，对目录和文件可以实施同样的操作

一个超级块对应一个文件系统，系统中可能一类文件系统有多个超级块，所有的超级块对象都以双向循环链表的形式链接在一起，其一起开始是存放于磁盘上，**内核对文件系统进行初始化和注册时会在内存中分配超级块，**而`s_fs_info`就指向具体文件系统的超级块，因为经常被操作会放入内存中。

文件名是可以随意修改的，但索引结点对文件是唯一的，随着文件的存在而存在，具体文件系统的索引结点是静态地存放于磁盘上的，要使用前必须先调入内存，填写 VFS 的索引结点，索引结点中存有指向`file_opration`的指针。

**目录项对象代表的是逻辑意义上的文件**，在磁盘上没有对应的映像，一个索引结点可能对应多个目录项对象，一个文件系统中所有目录项结构会被组成哈希表或者一棵树、一个链表，从**为文件访问和文件路径搜索提供可能**

### 与进程相关的文件结构

系统通过文件描述符（即==用户打开文件表中构建的文件对象指针的数组索引==）来抽象被进程打开的文件，一个进程可以打开多个文件，一个文件可以被多个进程共享，因此**进程通过用户打开文件表来描述所有打开的文件**，而进程和文件系统的关系通过`fs_struct`来描述

- 文件对象，`file`结构主要保存了文件位置，通过其`dentry`指针间接地**找到该文件的索引结点**，其会形成一个双向链表，称为系统打开文件表，因此每个文件对象会存放在下列的一个双向链表中：

  1. “未使用”文件对象链表，可以用做文件对面的内存缓冲区
  2. “正在使用”文件对象链表

- 用户打开文件表`files_struct`：是进程的私有数据，其表项指向的是 file 结构即文件对象

- ```c
  struct fs_struct{
    atomic_t count;
    rwlock_t lock;
    int umask;
    struct dentry *root,*pwd,*alroot;
    struct vfsmount *rootmnt,*pwdmnt,*alrootmnt;
  }
  ```

打开文件要在进程和文件之间建立一种连接，**“文件描述符”就唯一标识着这种连接**，而文件描述符就指向一个文件的上下文即`file`结构，通过目录项找到索引结点，同时要把**索引结点从磁盘中读入到内存**。对文件操作时，就必须**通过索引结点去调用具体文件系统提供的函数**，而基于磁盘的文件系统只需要调用 Linux 提供的通用函数`generic_file_read()`和`generic_file_write()`就可以实现相关操作

<div id="dev"></div>

## 第九章 设备驱动
