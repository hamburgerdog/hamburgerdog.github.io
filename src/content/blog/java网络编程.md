---
title: 'java网络编程学习'
date: 2020-11-30 23:25:00 +0800
tags: 后端
subtitle: 'Java network programming'
---

# java 网络编程学习

## 简介

用于存放学习 java 网络编程过程遇见的重难点笔记和相关代码

## IO Stream

### read() 和 write()

`public abstract int read(int) throws IOException`

`public abstract void write(int) throws IOException`

这两个抽象方法是由 `inputStream` 和 `outputStream` 的具体子类实现的，以`ByteArrayStream`类为例，重点讲解`read()`方法的一些特点：

```java
		/**
     * Reads the next byte of data from this input stream. The value
     * byte is returned as an {@code int} in the range
     * {@code 0} to {@code 255}. If no byte is available
     * because the end of the stream has been reached, the value
     * {@code -1} is returned.
     * <p>
     * This {@code read} method
     * cannot block.
     *
     * @return  the next byte of data, or {@code -1} if the end of the
     *          stream has been reached.
     */
    public synchronized int read() {
        return (pos < count) ? (buf[pos++] & 0xff) : -1;
    }

		/**
     * Writes the specified byte to this {@code ByteArrayOutputStream}.
     *
     * @param   b   the byte to be written.
     */
    public synchronized void write(int b) {
        ensureCapacity(count + 1);
        buf[count] = (byte) b;
        count += 1;
    }
```

`read()`虽然只读取 1 字节，但是会返回一个 int，在存放到字节数组的时候要进行类型转换，**这会产生一个-128 到 127 之间的有符号整数**，要特别注意 int 类型转换成 byte 类型会忽略掉高位，因此在写时最好使用 0-255 之间的 int 类型数据，否则就会出现这种情况(只保留了低 8 位)：

```java
    @Test
    public void testReader(){
        try(ByteArrayOutputStream out = new ByteArrayOutputStream(16)){
            out.write('*');
            out.flush();
            ByteArrayInputStream in = new ByteArrayInputStream(out.toByteArray());
            int read = in.read();
            System.out.println(read);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
    -------------------------------------------------------
     T E S T S
    -------------------------------------------------------
    Running
    1
```

在平时我们往往是使用`byte[]`来读写数据的，如等待读取网络流：

```java
	int bytesRead = 0;
	int bytesToRead = 1024;
	byte[] input = new byte[bytesToRead];
	while (bytesRead<bytesToRead){
    int result = in.read(input,bytesRead,bytesToRead - bytesRead);
    if (result == -1) break;
    bytesRead += result;
  }
```

当我们尝试读取暂时未满的缓冲区时，往往会返回 0，必须要等待所需的全部字节都可用才会返回长度，这往往比读取单字节方法好，因为这种情况下单字节方法会阻塞线程。如果要以非阻塞的方式获取缓存区的数据，可用`available()`方法来返回最小可读的数据长度，在流的最后该方法返回的是 0，而`read()`方法在流结束的时候返回-1，但**如果参数中的 length 是 0，则不会注意到流的结束，而继续返回 0**

### 过滤器

过滤器通过构造器串联到一起，但在多数情况下了不违背过滤器链间的隐形规范，我们应**当只对链中最后一个过滤器进行读写操作**：

```java
    @Test
    public void testFlitter() {
      	//	只对最后一个进行操作
        FileInputStream fileInputStream = new FileInputStream("data.txt");
        BufferedInputStream bufferedInputStream = new BufferedInputStream(fileInputStream);
				//	使用超类来实现永远只操作最后一个过滤器
        InputStream in = new FileInputStream("data.txt");
        in = new BufferedInputStream(in);
				//	使用超类中不存在的特定方法
        DataOutputStream dout = new DataOutputStream(
                                new BufferedOutputStream(
                                new FileOutputStream("data.txt")));

      	//	如果要使用链中多个过滤器的方法则要保证只对最后一个过滤器进行读写
    }
```

## 线程 - 多线程编程

### Future、Callable、Executor

创建一个==ExecutorService==，它会根据需要创建线程，可以将其理解为一个线程池，可以向它提交 Callable 任务，每个任务都会得到一个 Future，之后可以先 Future 请求得到任务的结果，如果结果未就绪轮询的线程会**阻塞**，直到任务完成。

```java
/**
 * 实现了比较大小的Callable
 */
public class FindMaxInt implements Callable<Integer> {
    private int array[];
    private int start;
    private int end;

    public FindMaxInt(int[] array, int start, int end) {
        this.array = array;
        this.start = start;
        this.end = end;
    }

    /**
     * 回调，在Future中被get()函数所处理
     * @return  比较结果
     * @throws Exception
     */
    @Override
    public Integer call() throws Exception {
        int max = Integer.MIN_VALUE;
        for (int i=start;i<end;i++){
            max = array[i]>=max?array[i]:max;
        }
        return max;
    }
}

@Test
public void doTest(){
  	//	array={0,1,2,3,4,5,6,7,8,9}
    int array[] = new int[10];
    for (int i =0;i<array.length;i++){
      array[i]=i;
    }

    FindMaxInt findMaxInt1 = new FindMaxInt(array, 0, array.length / 2);
    FindMaxInt findMaxInt2 = new FindMaxInt(array, array.length / 2,array.length);

    //  Executor：线程池 用于通过实现Callable的类创建任务，构造一个Future来处理任务
    ExecutorService threadPool = Executors.newFixedThreadPool(2);
    Future<Integer> submit1 = threadPool.submit(findMaxInt1);
    Future<Integer> submit2 = threadPool.submit(findMaxInt2);

    try {
      System.out.println(Math.max(submit1.get(),submit2.get()));
    } catch (InterruptedException e) {
      e.printStackTrace();
    } catch (ExecutionException e) {
      e.printStackTrace();
    }
}

  -------------------------------------------------------
   T E S T S
  -------------------------------------------------------
  Running Thread.TestCallable
  9
```

在最终结合两个`Future`的比较结果时，`submit1.get()` 和 `sb2~` 都会阻塞等待结果，只有两个线程都结束时才会比较他们的结果，并返回最大值。

使用线程池的时候，使用`submit()`就可以由`Executor`去选择线程池中某一空闲的线程来调用`Runnable`接口中的`run()`，一旦能够明确确定所有任务都已进入线程中，不需再使用线程池，就应当使用`Executors.shutdown()`来显示告知线程池关闭连接，这个操作不会中止等待中的工作，可以在还有工作要完成的情况下发生，不过==应当注意在网络程序中很小这样关闭线程池，因为无法确知终点。==

```java
    /**
     * Submits a value-returning task for execution and returns a
     * Future representing the pending results of the task. The
     * Future's {@code get} method will return the task's result upon
     * successful completion.
     *
     * <p>
     * If you would like to immediately block waiting
     * for a task, you can use constructions of the form
     * {@code result = exec.submit(aCallable).get();}
     *
     * <p>Note: The {@link Executors} class includes a set of methods
     * that can convert some other common closure-like objects,
     * for example, {@link java.security.PrivilegedAction} to
     * {@link Callable} form so they can be submitted.
     *
     * @param task the task to submit
     * @param <T> the type of the task's result
     * @return a Future representing pending completion of the task
     * @throws RejectedExecutionException if the task cannot be
     *         scheduled for execution
     * @throws NullPointerException if the task is null
     */
    <T> Future<T> submit(Callable<T> task);

    /**
     * Submits a Runnable task for execution and returns a Future
     * representing that task. The Future's {@code get} method will
     * return the given result upon successful completion.
     *
     * @param task the task to submit
     * @param result the result to return
     * @param <T> the type of the result
     * @return a Future representing pending completion of the task
     * @throws RejectedExecutionException if the task cannot be
     *         scheduled for execution
     * @throws NullPointerException if the task is null
     */
    <T> Future<T> submit(Runnable task, T result);

    /**
     * Submits a Runnable task for execution and returns a Future
     * representing that task. The Future's {@code get} method will
     * return {@code null} upon <em>successful</em> completion.
     *
     * @param task the task to submit
     * @return a Future representing pending completion of the task
     * @throws RejectedExecutionException if the task cannot be
     *         scheduled for execution
     * @throws NullPointerException if the task is null
     */
    Future<?> submit(Runnable task);
```

### 线程调度

一个线程有 10 种方式可以暂停或者指示它准备暂停：

- 可以对 IO 阻塞
- 可以对同步对象阻塞
- **可以放弃**，放弃表示线程原因暂停，让其他有相同优先级的线程有机会运行，但不会释放占有的锁，线程在放弃的时候一般不做任何的同步，在没有你要放弃的情况下，使用放弃效果不明显
- **可以休眠**，休眠是更有力的放弃，不管有没有其他线程准备运行，休眠线程都会暂停，这样可以有效的减少低优先级线程的“饥饿”，但其和放弃一样，不会释放占用的锁，要避免在同步方法或者块内让线程休眠。唤醒是通过调用休眠线程的`interrupt()`实现的，一个线程被休眠，其 Thread 对象还是可以得到处理（即可以调用对象的方法和字段）。休眠进程在唤醒后会得到一个异常，随后就转入到 catch 块中执行
- 可以连接另一个线程，连接线程等待被连接线程的结束，被连接线程即调用了`join()`的线程，**连接线程通常是隐式地作为当前线程存在的，没有作为参数传递给**`join()`，连接到另一个线程的线程可以被中断，如果线程被中断会跳过等待连接完成。
- **可以等待一个对象**，通常会配合在**等待对象**上使用`notify()` `notifyall()`方法来通知**与该对象有关的线程等待结束**，因为可能有多个线程等待同一对象，在通知前一定要得到该对象的锁。一旦线程等待通知就会尝试获得该对象的锁，否则会阻塞。==一般要将`wait()`放到检查当前对象状态的循环中，不能因为线程得到了通知就认为对象一定处在正确的情况下。==
  _有三种情况会终止`wait()`引起的睡眠：_
  - _时间到期_
  - _线程被中断_
  - _对象得到通知_
- 可以结束
- 可以被更高优先级的线程抢占
- 可以挂起
- 可以停止

最后两种已被舍弃，因为这会可能会让对象处于不一致状态

<div id="inet"></div>

## internet 地址

### 按 IP 地址查找

调用`getByname()`并提供一个 IP 地址串做参数会创建一个 internet 地址对象，当实际上可能并不存在这样的主机，因为只有在`getHostName()`显式请求主机名的时候才会进行 DNS 检查，如果请求主机名并最终完成了一个 DNS 查找，但是指定 IP 地址的主机无法找到，那主机名也会保持为最初的字符串（即点分四段字符串），主机名比 IP 地址稳定很多，**从主机名创建一个新的 InetAddress 对象被认为是不安全的，因为这需要进行 DNS 查找。**

**Object 方法**：

- `public boolean equals(Object o)`判断的时候只会对 IP 地址进行分析，主机名不会被解析，即意味则相同 IP 地址的两台机器会被认为是相等的
- `public int hashCode()`和`equals()`一致，只会生成 IP 地址的哈希值
- `public String toString()`主机名加 IP 地址

### 多线程处理服务器日志的案例

```java
/**
 *	处理日志的线程
 */
public class LookupTask implements Callable<String> {

  private String line;
  public LookupTask(String line) {
    this.line = line;
  }

  @Override
  public String call() {
    try {
      // separate out the IP address
      int index = line.indexOf(' ');
      String address = line.substring(0, index);
      String theRest = line.substring(index);
      String hostname = InetAddress.getByName(address).getHostName();
      return hostname + " " + theRest;
    } catch (Exception ex) {
      return line;
    }
  }
}

/**
 *	主线程
 */
public class PooledWeblog {

  private final static int NUM_THREADS = 4;	//	线程池的大小

  public static void main(String[] args) throws IOException {
    ExecutorService executor = Executors.newFixedThreadPool(NUM_THREADS);
    Queue<LogEntry> results = new LinkedList<LogEntry>();

    try (BufferedReader in = new BufferedReader(
      new InputStreamReader(new FileInputStream(args[0]), "UTF-8"));) {
      for (String entry = in.readLine(); entry != null; entry = in.readLine()) {
        LookupTask task = new LookupTask(entry);
        Future<String> future = executor.submit(task);
        LogEntry result = new LogEntry(entry, future);
        results.add(result);
      }
    }
    // Start printing the results. This blocks each time a result isn't ready.阻塞！
    for (LogEntry result : results) {
      try {
        System.out.println(result.future.get());
      } catch (InterruptedException | ExecutionException ex) {
        System.out.println(result.original);
      }
    }
    executor.shutdown();
  }

  private static class LogEntry {
    String original;
    Future<String> future;

    LogEntry(String original, Future<String> future) {
     this.original = original;
     this.future = future;
    }
  }
}
```

> 日志文件过于庞大的时候，这个程序会占用很大的内存，为了避免这个问题可以将输出也放到一个单独的线程之中，与输入共享一个队列，这样可以避免队列膨胀，但**需要有个信号告知输出线程可以运行了**

<div id="url"></div>

## URL 和 URI

### URL

**URL 由一下 5 个部分组成：**

- 协议
- 授权机构
- 路径
- 片段标识符，ref（锚点）
- 查询字符串

**有四个构造器方法：**

1. String url 由字符串形式的绝对 URL 作为唯一参数直接生成一个 URL，如果构造不成功，说明不支持这个协议，==除了能验证协议外，JAVA 不会对构造的 URL 完成任何正确性检查==
2. String protocol， String hostname，String file 使用该协议的默认端口号，**file 参数必须加 / 开头**
3. String protocol， String hostname，int port，String file 指定端口号
4. URL base，String relative 基于父 URL 生成相对 URL

**从 URL 获取数据：**

```java
//	四个方法都会抛出IOException

//	缺点：默认获取的数据都是URL引用的原始内容，
public InputStream openStream();

//	可以和服务器直接通信，访问服务器发送的所有数据和协议的元数据:即可以访问首部信息
public URLConnection openConnection();

//	指定代理服务器
public URLConnection openConnection(Proxy proxy);

//	从服务器获取的数据首部中找Content-type字段来获取对象
public Object getContent();

//	解决getContent()难以预测获得哪种对象的问题
public Object getContent(Class[] clazz);
```

**URL 间相等性与比较**：

`equals()`方法在处理主机名的时候会尝试用 DNS 解析，只有两个 URL 都指向同一个主机、端口和路径上的相同资源，而且有相同的片段标识符合查询字符串时，才认为 URL 是相等的，`hashCode()`也同理。为了具体比较 URL 标识的资源可以使用`sameFile()`，这个方法可以检查两个 URL 是否指向相同的资源（也包括 DNS 查询）。

> **警告 ⚠️**：URL 上的`equals()`可能是一个阻塞 IO 的操作，应当避免将 URL 存放到依赖该方法的结构中，如`java.util.HashMap`更好的选择方式是`java.net.URI`

`URL.toString()`生成一个绝对 URL 字符串，使用`toExternalForm()`打印信息更合适，该方法将一个 URL 对象转换为一个字符串，事实上`toString()`调用的就是该方法，最后使用`toURI()`可以将 URL 转换成 URI，URI 类提供了更精确、更符合规范的操作行为，**URL 类应当主要用于从服务器中下载内容。**

### URI

URL 对象对应网络获取应用层协议的一个表示，而 URI 对象纯粹用于解析和处理字符串，URI 没有网络获取功能。URI 从字符串中构造，其**并不依赖底层协议处理器**，只要 URI 语法上正确，Java 就不需要理解与 URI 相关的协议。

URI 引用最多有三个部分：模式、模式特定部分和片段标识符，与 URI 规范不同，URI 可以使用非 ASCII 字符，URI 类中非 ASCII 字符不会想完成百分号的转义，这样在`getRawFoo()`这类获取 URI 原始编码部分的方法中，也不会得到用百分号转义后的字符，同时 URI 对象是不可变的，这对线程安全有帮助。

**比较和相等：**相等的 URI 必须同为层次或者不透明的，比较模式和授权机构时不区分大小写，其余部分区分

`toString()`返回 URI 的未边发字符串形式，无法保证这是一个语法正确的 URI，这种方法适合人阅读但不适合用来获取数据，`toASCIISting()`返回 URI 的编码字符串，大多数时候都应该使用这种 URI 字符串形式。

### x-www-form-urlencoded

不同操作系统之间是有区别 的，web 设计人员要处理这种差异，如有些操作系统允许文件名中有空格，但大部分都不允许，为了解决这类问题必须把 URL 使用的字符规定为必须来自 ASCII 的一个固定子集：

- `[a-zA-z0-9-_.!~*‘(,)]`

- 字符 / & ? @ ; $ + = % 也可以使用，但只能用于特殊用途，如果在路径或查询字符串中都应该被编码

URL 类不会自动编码和解码，因此需要使用`URLEncode`和`URLDecode`这两个类来编码解码，编码方式很简单，字符转换为字节，每个字节要写为百分号后面加两个十六进制数字，URL 更部分之间的分隔符不需要编码

在编码的时候必须逐个部分对 URL 进行编码，而不是对整个 URL 进行编码，通常只有路径和查询字符串需要被编码，解码是可以传入整个 URL，因为解码方法对非转义字符不会进行处理

```java
public class QueryString {

  private StringBuilder query = new StringBuilder();

  public QueryString() {
  }

  public synchronized void add(String name, String value) {
    query.append('&');
    encode(name, value);
  }

  private synchronized void encode(String name, String value) {
    try {
      query.append(URLEncoder.encode(name, "UTF-8"));
      query.append('=');
      query.append(URLEncoder.encode(value, "UTF-8"));
    } catch (UnsupportedEncodingException ex) {
      throw new RuntimeException("Broken VM does not support UTF-8");
    }
  }

  public synchronized String getQuery() {
    return query.toString();
  }

  @Override
  public String toString() {
    return getQuery();
  }

  public static void main(String[] args) {
    QueryString qs = new QueryString();
    qs.add("h1", "en");
    qs.add("as_q", "Java");
    qs.add("as_epq", "I/O");
    String url = "http://www.test.com/search?" + qs;
    System.out.println(url);
  }
}
```

<div id="http"></div>

## HTTP

### HTTP 方法

- GET，获取一个资源表示，没有副作用，如果失败可以重复执行 GET
- POST，提交表单，先服务器提交数据，要防止重复提交
- HEAD，和 GET 方法相似，但不会获得请求的主体，只需要起始行和请求 HTTP 首部
- PUT，和 GET 相似无副作用，可以重复该方法把同一个文档放在同一个服务器的同一个位置
- DELETE，有权限安全问题
- OPTION
- TRACE

HTTP 首部中两个比较关键面字段：`Content-type`指明 MIME 媒体类型，`Content-length`指明主体的长度，这对传送一个二进制类型的文件而言很重要

### Cookie

一种用于存储连接件持久客户端状态的小文本串，cookie 在请求和响应的 HTTP 首部，从服务器传给客户端，再从客户端传到服务器，cookie 中通常不包含数据，只是指示服务器上的数据，用`CookeiManager`和`CookieStore`来管理和在本地存放和获取 cookie

<div id="urlc"></div>

## URLConnection

> **URLConnection 和 HTTP 联系过于紧密**，默认每个传输文件前都有一个 MIME 首部或类型的东西

URLConnection 是一个抽象类，在运行时环境使用`java.lang.Class.forName().newInstance` (java7 未过时的方法 )来实例化这个类，不过该抽象类中只有一个`connect()`方法需要具体的子类实现，它建立与服务器的连接，需要依赖具体的协议，直接使用 URLConnection 类的程序遵循以下步骤：

1. 构造一个 URL 对象
2. 调用 URL 对象的`openConnection()`获取一个对应的 URLConnection
3. 配置 URLConnection
4. 读取首部字段
5. 获取输入流
6. 获得输出流
7. 关闭连接

**读数据的方法**`public int getContentLength()`：

HTTP 服务器不总会在数据发送完后就立即关闭联系，因此在读取数据的时候不知道是何时停止读取的，要下载一个二进制文件，更可靠的方式是想获取一个文件的长度，在根据这个长度读取相应的字节数，很多服务器不会费力的为文本文件提供`content-length`首部，但是对二进制文件来说这个首部是必须的

### 配置连接

7 个保护的实例字段

[![D66YFA.png](https://s3.ax1x.com/2020/11/29/D66YFA.png)](https://imgchr.com/i/D66YFA)

有对应设置和获取方法，==只能在 URLConnection 连接前修改这些实例字段，即实例方法必须在连接前使用==

### 缓存

使用 GET 和 HTTP 访问的页面通常可以缓存，HTTPS 和 POST 的通常不缓存，客户端在请求资源的时候会询问服务器资源是否有被更新过，即如果资源的最后修改时间比客户端上一次获取资源的时间要晚则说明资源需要重新更新，或者资源缓存时间到期也需要更新。`Etag`首部就是资源改变时这个资源的唯一标识符

### 流模式

通常填写`content-length`需要知道主体的长度，而在写首部的时候往往不知道该值，因此 JAVA 会先把资源缓存，直到流关闭才可以知道该值，但当处理很长的表单时，响应的负担会很大，Java 是这样解决的：

1. 预先知道数据的大小，如使用 PUT 上传文件时可以告诉 HttpURLConnection 对象文件大小
2. 分块，请求主体以多个部分发送，这样需要再连接 URL 之前将分块大小告知连接

这两种方式对身份认证和重定向有一定的影响，除非确实有必要，否则不要使用流模式

<div id="so"></div>

## 客户端 Socket

> 数据按有限大小的包传输，即数据报，每个数据报通常包括一个首部和一个有效荷载。**Socket 允许程序员将网络连接看成是一个可读写的字节流来操作**，覆盖了网络底层的细节，如错误检测、包大小、包分解、包重传、网络地址等。

### 构造和连接 Socket

`public Socket(String host, int port) throw unknownHostException,IOException`

`public Socket(InetAddress host, int port) throw IOException`

这些构造函数在使用的时候会建立网络连接，因此可以用来确定是否允许与某个端口建立连接，除此还可以选择通过连接主机和端口，以及从哪个接口和端口连接。

`public Socket()`

`public Socket(Proxy proxy)`

`public Socket(SocketImpl impl)`

而这三个构造器可以不建立连接，因此在可以预先配置套接字的属性再使用`connect(SocketAddress)`进行连接，实现更多控制

**设置 Socket 的选项**

- TCP_NODELAY 不缓冲，尽可能快速地发送包，无论包大小，不需要小包组成大包
- SO_BINDADDR
- SO_TIMEOUT 从 Socket 中读数据时，`read()`会阻塞，这个选项设置等待时间
- SO_LINGER 延迟关闭时间，如果为 0 则 Socket 关闭的时候会发送的数据都会丢弃
- SO_SNDBUF
- SO_RCVBUF
- SO_KEEPALIVE 客户端确定服务器存活，防止客户端在服务器崩溃的情况下永远存活
- OOBINLINE ==Out Of Band==紧急数据报，应用程序会在队列中寻找 OOB
- IP_TOS

### 读写 Socket

大多数网络程序中，重点工作通常是使用协议和理解数据格式，有的协议只允许处理 ASCII 字符，有的协议则只对客户端发送时间而不理会客户端发送的数据......读写程序只需要 Socket 打开底层读的流和写的流就可以了

```java
//	Daytime协议客户端
public class Daytime {

  public Date getDateFromNetwork() throws IOException, ParseException {
    try (Socket socket = new Socket("time.nist.gov", 13)) {
      //	setTimeout可以防止服务器异常导致客户端永久存活 推荐每次连接都要使用这一步
      socket.setSoTimeout(15000);
      //	读取服务器数据
      InputStream in = socket.getInputStream();
      StringBuilder time = new StringBuilder();
      //	只允许ASCII
      InputStreamReader reader = new InputStreamReader(in, "ASCII");
      for (int c = reader.read(); c != -1; c = reader.read()) {
        time.append((char) c);
      }
      return parseDate(time.toString());
    }
  }

  static Date parseDate(String s) throws ParseException {
    String[] pieces = s.split(" ");
    String dateTime = pieces[1] + " " + pieces[2] + " UTC";
    DateFormat format = new SimpleDateFormat("yy-MM-dd hhss z");
    return format.parse(dateTime);
  }
}

//	客户端运行程序
public class DaytimeClient {

  public static void main(String[] args) {

    String hostname = args.length > 0 ? args[0] : "time.nist.gov";
    Socket socket = null;
    try {
      //	创建对象的同时建立连接
      socket = new Socket(hostname, 13);
      socket.setSoTimeout(15000);
      InputStream in = socket.getInputStream();
      StringBuilder time = new StringBuilder();
      InputStreamReader reader = new InputStreamReader(in, "ASCII");
      for (int c = reader.read(); c != -1; c = reader.read()) {
        time.append((char) c);
      }
      System.out.println(time);
    } catch (IOException ex) {
      System.err.println(ex);
    } finally {
      if (socket != null) {
        try {
          socket.close();
        } catch (IOException ex) {
          // ignore
        }
      }
    }
  }
}
```

有时候需要向服务器写原始的字节流，但有时候也可以向服务器写字符，这时候将底层流进行缓存并提供书写器是一种好的解决方法，要注意在换行的时候要显式选择行结束符'\r\n'，而不是使用系统的分隔符，在写入完成后用`flush()`刷新一下流

```java
public class DictClient {

  public static final String SERVER = "dict.org";
  public static final int PORT = 2628;
  public static final int TIMEOUT = 15000;

  public static void main(String[] args) {

    Socket socket = null;
    try {
      socket = new Socket(SERVER, PORT);
      socket.setSoTimeout(TIMEOUT);
      OutputStream out = socket.getOutputStream();
      //  书写器
      Writer writer = new OutputStreamWriter(out, "UTF-8");
      writer = new BufferedWriter(writer);
      InputStream in = socket.getInputStream();
      BufferedReader reader = new BufferedReader(
          new InputStreamReader(in, "UTF-8"));
      for (String word : args) {
        define(word, writer, reader);
      }
      writer.write("quit\r\n");
      //  刷新流
      writer.flush();
    } catch (IOException ex) {
      System.err.println(ex);
    } finally { // dispose
      if (socket != null) {
        try {
          socket.close();
        } catch (IOException ex) {
          // ignore
        }
      }
    }
  }

  static void define(String word, Writer writer, BufferedReader reader)
      throws IOException, UnsupportedEncodingException {
    writer.write("DEFINE eng-lat " + word + "\r\n");
    writer.flush();

    for (String line = reader.readLine(); line != null; line = reader.readLine()) {
      if (line.startsWith("250 ")) { // OK
        return;
      } else if (line.startsWith("552 ")) { // no match
        System.out.println("No definition found for " + word);
        return;
      }
      else if (line.matches("\\d\\d\\d .*")) continue;
      else if (line.trim().equals(".")) continue;
      else System.out.println(line);
    }
  }
}
```

**半关闭 Socket**

使用`shutdownInput()`&`shutdownOutput()`来关闭输入输出，但是最终一定要通过`close()`真正地关闭这个流，因为 shutdown 方法不会释放与 Socket 相关的资源

> 课程提供的一个很实用的 GUI 应用，其中包含了客户端 Socket 的很多知识，还介绍了**对网络连接的 GUI 设计很重要的一个 SwingWorker 类**

```java
//	建立Socket的主类
import java.net.*;
import java.io.*;

public class Whois {

  public final static int DEFAULT_PORT = 43;
  public final static String DEFAULT_HOST = "whois.internic.net";

  private int port = DEFAULT_PORT;
  private InetAddress host;

  public Whois(InetAddress host, int port) {
    this.host = host;
    this.port = port;
  }

  public Whois(InetAddress host) {
    this(host, DEFAULT_PORT);
  }

  public Whois(String hostname, int port)
   throws UnknownHostException {
    this(InetAddress.getByName(hostname), port);
  }

  public Whois(String hostname) throws UnknownHostException {
    this(InetAddress.getByName(hostname), DEFAULT_PORT);
  }

  public Whois() throws UnknownHostException {
    this(DEFAULT_HOST, DEFAULT_PORT);
  }

  // Items to search for
  public enum SearchFor {
    ANY("Any"), NETWORK("Network"), PERSON("Person"), HOST("Host"),
    DOMAIN("Domain"), ORGANIZATION("Organization"), GROUP("Group"),
    GATEWAY("Gateway"), ASN("ASN");

    private String label;

    private SearchFor(String label) {
      this.label = label;
    }
  }

  // Categories to search in
  public enum SearchIn {
    ALL(""), NAME("Name"), MAILBOX("Mailbox"), HANDLE("!");

    private String label;

    private SearchIn(String label) {
      this.label = label;
    }
  }

  public String lookUpNames(String target, SearchFor category,
      SearchIn group, boolean exactMatch) throws IOException {

    String suffix = "";
    if (!exactMatch) suffix = ".";

    String prefix = category.label + " " + group.label;
    String query = prefix + target + suffix;

    Socket socket = new Socket();
    try {
      SocketAddress address = new InetSocketAddress(host, port);
      socket.connect(address);
      Writer out
          = new OutputStreamWriter(socket.getOutputStream(), "ASCII");
      BufferedReader in = new BufferedReader(new
          InputStreamReader(socket.getInputStream(), "ASCII"));
      out.write(query + "\r\n");
      out.flush();

      StringBuilder response = new StringBuilder();
      String theLine = null;
      while ((theLine = in.readLine()) != null) {
        response.append(theLine);
        response.append("\r\n");
      }
      return response.toString();
    } finally {
      socket.close();
    }
  }

  public InetAddress getHost() {
    return this.host;
  }

  public void setHost(String host)
      throws UnknownHostException {
    this.host = InetAddress.getByName(host);
  }
}
```

```java
//	GUI界面 主要看内部类和事件监听处理方法
import java.awt.*;
import java.awt.event.*;
import java.net.*;
import javax.swing.*;

public class WhoisGUI extends JFrame {

  private JTextField searchString = new JTextField(30);
  private JTextArea names = new JTextArea(15, 80);
  private JButton findButton = new JButton("Find");;
  private ButtonGroup searchIn = new ButtonGroup();
  private ButtonGroup searchFor = new ButtonGroup();
  private JCheckBox exactMatch = new JCheckBox("Exact Match", true);
  private JTextField chosenServer = new JTextField();
  private Whois server;

  public WhoisGUI(Whois whois) {
    super("Whois");
    this.server = whois;
    Container pane = this.getContentPane();

    Font f = new Font("Monospaced", Font.PLAIN, 12);
    names.setFont(f);
    names.setEditable(false);

    JPanel centerPanel = new JPanel();
    centerPanel.setLayout(new GridLayout(1, 1, 10, 10));
    JScrollPane jsp = new JScrollPane(names);
    centerPanel.add(jsp);
    pane.add("Center", centerPanel);

    // You don't want the buttons in the south and north
    // to fill the entire sections so add Panels there
    // and use FlowLayouts in the Panel
    JPanel northPanel = new JPanel();
    JPanel northPanelTop = new JPanel();
    northPanelTop.setLayout(new FlowLayout(FlowLayout.LEFT));
    northPanelTop.add(new JLabel("Whois: "));
    northPanelTop.add("North", searchString);
    northPanelTop.add(exactMatch);
    northPanelTop.add(findButton);
    northPanel.setLayout(new BorderLayout(2,1));
    northPanel.add("North", northPanelTop);
    JPanel northPanelBottom = new JPanel();
    northPanelBottom.setLayout(new GridLayout(1,3,5,5));
    northPanelBottom.add(initRecordType());
    northPanelBottom.add(initSearchFields());
    northPanelBottom.add(initServerChoice());
    northPanel.add("Center", northPanelBottom);

    pane.add("North", northPanel);

    //  添加事件处理
    ActionListener al = new LookupNames();
    findButton.addActionListener(al);
    searchString.addActionListener(al);
  }

  private JPanel initRecordType() {
    JPanel p = new JPanel();
    p.setLayout(new GridLayout(6, 2, 5, 2));
    p.add(new JLabel("Search for:"));
    p.add(new JLabel(""));

    JRadioButton any = new JRadioButton("Any", true);
    any.setActionCommand("Any");
    searchFor.add(any);
    p.add(any);

    p.add(this.makeRadioButton("Network"));
    p.add(this.makeRadioButton("Person"));
    p.add(this.makeRadioButton("Host"));
    p.add(this.makeRadioButton("Domain"));
    p.add(this.makeRadioButton("Organization"));
    p.add(this.makeRadioButton("Group"));
    p.add(this.makeRadioButton("Gateway"));
    p.add(this.makeRadioButton("ASN"));

    return p;
  }

  private JRadioButton makeRadioButton(String label) {
    JRadioButton button = new JRadioButton(label, false);
    button.setActionCommand(label);
    searchFor.add(button);
    return button;
  }

  private JRadioButton makeSearchInRadioButton(String label) {
    JRadioButton button = new JRadioButton(label, false);
    button.setActionCommand(label);
    searchIn.add(button);
    return button;
  }

  private JPanel initSearchFields() {
    JPanel p = new JPanel();
    p.setLayout(new GridLayout(6, 1, 5, 2));
    p.add(new JLabel("Search In: "));

    JRadioButton all = new JRadioButton("All", true);
    all.setActionCommand("All");
    searchIn.add(all);
    p.add(all);

    p.add(this.makeSearchInRadioButton("Name"));
    p.add(this.makeSearchInRadioButton("Mailbox"));
    p.add(this.makeSearchInRadioButton("Handle"));

    return p;
  }

  private JPanel initServerChoice() {
    final JPanel p = new JPanel();
    p.setLayout(new GridLayout(6, 1, 5, 2));
    p.add(new JLabel("Search At: "));

    chosenServer.setText(server.getHost().getHostName());
    p.add(chosenServer);
    chosenServer.addActionListener( new ActionListener() {
      @Override
      public void actionPerformed(ActionEvent event) {
        try {
          server = new Whois(chosenServer.getText());
        } catch (UnknownHostException ex) {
           JOptionPane.showMessageDialog(p,
             ex.getMessage(), "Alert", JOptionPane.ERROR_MESSAGE);
        }
      }
    } );

    return p;
  }

  private class LookupNames implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent event) {
      names.setText("");
      SwingWorker<String, Object> worker = new Lookup();
      worker.execute();
    }
  }

  private class Lookup extends SwingWorker<String, Object> {

    @Override
    protected String doInBackground() throws Exception {
      Whois.SearchIn group = Whois.SearchIn.ALL;
      Whois.SearchFor category = Whois.SearchFor.ANY;

      String searchForLabel = searchFor.getSelection().getActionCommand();
      String searchInLabel = searchIn.getSelection().getActionCommand();

      if (searchInLabel.equals("Name")) group = Whois.SearchIn.NAME;
      else if (searchInLabel.equals("Mailbox")) {
        group = Whois.SearchIn.MAILBOX;
      } else if (searchInLabel.equals("Handle")) {
        group = Whois.SearchIn.HANDLE;
      }

      if (searchForLabel.equals("Network")) {
        category = Whois.SearchFor.NETWORK;
      } else if (searchForLabel.equals("Person")) {
        category = Whois.SearchFor.PERSON;
      } else if (searchForLabel.equals("Host")) {
        category = Whois.SearchFor.HOST;
      } else if (searchForLabel.equals("Domain")) {
        category = Whois.SearchFor.DOMAIN;
      } else if (searchForLabel.equals("Organization")) {
        category = Whois.SearchFor.ORGANIZATION;
      } else if (searchForLabel.equals("Group")) {
        category = Whois.SearchFor.GROUP;
      } else if (searchForLabel.equals("Gateway")) {
        category = Whois.SearchFor.GATEWAY;
      } else if (searchForLabel.equals("ASN")) {
        category = Whois.SearchFor.ASN;
      }

      server.setHost(chosenServer.getText());
      return server.lookUpNames(searchString.getText(),
         category, group, exactMatch.isSelected());
    }

    @Override
    protected void done() {
      try {
        names.setText(get());
      } catch (Exception ex) {
        JOptionPane.showMessageDialog(WhoisGUI.this,
            ex.getMessage(), "Lookup Failed", JOptionPane.ERROR_MESSAGE);
      }
    }
  }

  public static void main(String[] args) {
    try {
      Whois server = new Whois();
      WhoisGUI a = new WhoisGUI(server);
      a.setDefaultCloseOperation(WindowConstants.EXIT_ON_CLOSE);
      a.pack();
      EventQueue.invokeLater(new FrameShower(a));
    } catch (UnknownHostException ex) {
      JOptionPane.showMessageDialog(null, "Could not locate default host "
          + Whois.DEFAULT_HOST, "Error", JOptionPane.ERROR_MESSAGE);
    }
  }

  private static class FrameShower implements Runnable {

    private final Frame frame;
    FrameShower(Frame frame) {
      this.frame = frame;
    }

    @Override
    public void run() {
     frame.setVisible(true);
    }
  }
}
```

<div id="sso"></div>

## 服务器 Socket

构建一个 ServerSocket 时，最好使用一个无参构造器，其不会抛出任何异常也不绑定到任何一个端口，只有在连接前使用`bind()`才会绑定一个 Socket 地址，在创建但为绑定到端口前我们不认为 ServerSocket 是关闭的，调用`isClose()`会返回 false，调用`isBind()`才会指出是否绑定了接口。

**多线程服务器**

有时候发送数据时会有一个网络速度慢或者崩溃的客户端使服务器挂起，这样发送数据会导致网络良好的客户端接受数据也很慢，通常我们都需要使用一个多线程服务器来处理这个问题，java 建立队列来允许网络连接的数量，即创建一个线程池，为每一个连接提供一个线程。

在多线程模式下，服务器接受客户端的 socket 时，**不会使用 try-with-resource 方法来自动关闭连接**，因为如果主线程到达结尾会关闭 socket，而新线程可能还需要使用 Socket

### 日志

记录日志最容易的方法是为每个类创建一个日志工具：

`private final static Logger auditLogger = Logger.getLogger("request");`

使用`log()`方法就可以记录日志

```java
//	记录日志的例子
import java.io.*;
import java.net.*;
import java.util.Date;
import java.util.concurrent.*;
import java.util.logging.*;

public class LoggingDaytimeServer {

  public final static int PORT = 13;
  private final static Logger auditLogger = Logger.getLogger("requests");
  private final static Logger errorLogger = Logger.getLogger("errors");

  public static void main(String[] args) {

   ExecutorService pool = Executors.newFixedThreadPool(50);

   try (ServerSocket server = new ServerSocket(PORT)) {
     while (true) {
       try {
         Socket connection = server.accept();
         Callable<Void> task = new DaytimeTask(connection);
         pool.submit(task);
       } catch (IOException ex) {
         errorLogger.log(Level.SEVERE, "accept error", ex);
       } catch (RuntimeException ex) {
         errorLogger.log(Level.SEVERE, "unexpected error " + ex.getMessage(), ex);
       }
     }
    } catch (IOException ex) {
      errorLogger.log(Level.SEVERE, "Couldn't start server", ex);
    } catch (RuntimeException ex) {
      errorLogger.log(Level.SEVERE, "Couldn't start server: " + ex.getMessage(), ex);
    }
  }

  private static class DaytimeTask implements Callable<Void> {

    private Socket connection;

    DaytimeTask(Socket connection) {
      this.connection = connection;
    }

    @Override
    public Void call() {
      try {
        Date now = new Date();
        // write the log entry first in case the client disconnects
        auditLogger.info(now + " " + connection.getRemoteSocketAddress());
        Writer out = new OutputStreamWriter(connection.getOutputStream());
        out.write(now.toString() +"\r\n");
        out.flush();
      } catch (IOException ex) {
          // client disconnected; ignore;
      } finally {
        try {
          connection.close();
        } catch (IOException ex) {
          // ignore;
        }
      }
      return null;
    }
  }
}
```

### 构造 ServerSocket 的方法

- int port 监听端口
- int port , int queueLength 设置最长队列
- int port , int queueLength , InetAddress bindAddress 绑定特定的端口
- 无参构造器

**ServerSocket 选项**

- SO_TIMEOUT
- SO_REUSEADDR 一个新的 Socket 可否连接到之前使用的端口上，此时可能会还有数据在传输
- SO_RCVBUF

### 单文件 HTTP 服务器

```java
import java.io.*;
import java.net.*;
import java.nio.charset.Charset;
import java.nio.file.*;
import java.util.concurrent.*;
import java.util.logging.*;

public class SingleFileHTTPServer {

  private static final Logger logger = Logger.getLogger("SingleFileHTTPServer");

  private final byte[] content;
  private final byte[] header;
  private final int port;
  private final String encoding;

  public SingleFileHTTPServer(String data, String encoding,
      String mimeType, int port) throws UnsupportedEncodingException {
    this(data.getBytes(encoding), encoding, mimeType, port);
  }

  public SingleFileHTTPServer(
      byte[] data, String encoding, String mimeType, int port) {
    this.content = data;
    this.port = port;
    this.encoding = encoding;
    String header = "HTTP/1.0 200 OK\r\n"
        + "Server: OneFile 2.0\r\n"
        + "Content-length: " + this.content.length + "\r\n"
        + "Content-type: " + mimeType + "; charset=" + encoding + "\r\n\r\n";
    this.header = header.getBytes(Charset.forName("US-ASCII"));
  }

  public void start() {
    ExecutorService pool = Executors.newFixedThreadPool(100);
    try (ServerSocket server = new ServerSocket(this.port)) {
      logger.info("Accepting connections on port " + server.getLocalPort());
      logger.info("Data to be sent:");
      logger.info(new String(this.content, encoding));

      while (true) {
        try {
          Socket connection = server.accept();
          pool.submit(new HTTPHandler(connection));
        } catch (IOException ex) {
          logger.log(Level.WARNING, "Exception accepting connection", ex);
        } catch (RuntimeException ex) {
          logger.log(Level.SEVERE, "Unexpected error", ex);
        }
      }
    } catch (IOException ex) {
      logger.log(Level.SEVERE, "Could not start server", ex);
    }
  }

  private class HTTPHandler implements Callable<Void> {
    private final Socket connection;

    HTTPHandler(Socket connection) {
      this.connection = connection;
    }

    @Override
    public Void call() throws IOException {
      try {
        OutputStream out = new BufferedOutputStream(
                                connection.getOutputStream()
                               );
        InputStream in = new BufferedInputStream(
                                connection.getInputStream()
                               );
        // read the first line only; that's all we need
        StringBuilder request = new StringBuilder(80);
        while (true) {
          int c = in.read();
          if (c == '\r' || c == '\n' || c == -1) break;
          request.append((char) c);
        }
        // If this is HTTP/1.0 or later send a MIME header
        if (request.toString().indexOf("HTTP/") != -1) {
          out.write(header);
        }
        out.write(content);
        out.flush();
      } catch (IOException ex) {
        logger.log(Level.WARNING, "Error writing to client", ex);
      } finally {
        connection.close();
      }
      return null;
    }
  }

  public static void main(String[] args) {

    // set the port to listen on
    int port;
    try {
      port = Integer.parseInt(args[1]);
      if (port < 1 || port > 65535) port = 80;
    } catch (RuntimeException ex) {
      port = 80;
    }

    String encoding = "UTF-8";
    if (args.length > 2) encoding = args[2];

    try {
      Path path = Paths.get(args[0]);;
      byte[] data = Files.readAllBytes(path);

      String contentType = URLConnection.getFileNameMap().getContentTypeFor(args[0]);
      SingleFileHTTPServer server = new SingleFileHTTPServer(data, encoding,
          contentType, port);
      server.start();

    } catch (ArrayIndexOutOfBoundsException ex) {
      System.out.println(
          "Usage: java SingleFileHTTPServer filename port encoding");
    } catch (IOException ex) {
      logger.severe(ex.getMessage());
    }
  }
}
```

### 重定向器 Redirector

```java
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.logging.*;

public class Redirector {

  private static final Logger logger = Logger.getLogger("Redirector");

  private final int port;
  private final String newSite;

  public Redirector(String newSite, int port) {
    this.port = port;
    this.newSite = newSite;
  }

  public void start() {
    try (ServerSocket server = new ServerSocket(port)) {
      logger.info("Redirecting connections on port "
          + server.getLocalPort() + " to " + newSite);

      while (true) {
        try {
          Socket s = server.accept();
          Thread t = new RedirectThread(s);
          t.start();
        } catch (IOException ex) {
          logger.warning("Exception accepting connection");
        } catch (RuntimeException ex) {
          logger.log(Level.SEVERE, "Unexpected error", ex);
        }
      }
    } catch (BindException ex) {
      logger.log(Level.SEVERE, "Could not start server.", ex);
    } catch (IOException ex) {
      logger.log(Level.SEVERE, "Error opening server socket", ex);
    }
  }

  private class RedirectThread extends Thread {

    private final Socket connection;

    RedirectThread(Socket s) {
      this.connection = s;
    }

    public void run() {
      try {
        Writer out = new BufferedWriter(
                      new OutputStreamWriter(
                       connection.getOutputStream(), "US-ASCII"
                      )
                     );
        Reader in = new InputStreamReader(
                     new BufferedInputStream(
                      connection.getInputStream()
                     )
                    );

        // read the first line only; that's all we need
        StringBuilder request = new StringBuilder(80);
        while (true) {
          int c = in.read();
          if (c == '\r' || c == '\n' || c == -1) break;
          request.append((char) c);
        }

        String get = request.toString();
        String[] pieces = get.split("\\w*");
        String theFile = pieces[1];

        // If this is HTTP/1.0 or later send a MIME header
        if (get.indexOf("HTTP") != -1) {
          //	302重定向状态码 很重要
          out.write("HTTP/1.0 302 FOUND\r\n");
          Date now = new Date();
          out.write("Date: " + now + "\r\n");
          out.write("Server: Redirector 1.1\r\n");
          out.write("Location: " + newSite + theFile + "\r\n");
          out.write("Content-type: text/html\r\n\r\n");
          out.flush();
        }
        // Not all browsers support redirection so we need to
        // produce HTML that says where the document has moved to.
        out.write("<HTML><HEAD><TITLE>Document moved</TITLE></HEAD>\r\n");
        out.write("<BODY><H1>Document moved</H1>\r\n");
        out.write("The document " + theFile
         + " has moved to\r\n<A HREF=\"" + newSite + theFile + "\">"
         + newSite  + theFile
         + "</A>.\r\n Please update your bookmarks<P>");
        out.write("</BODY></HTML>\r\n");
        out.flush();
        logger.log(Level.INFO,
            "Redirected " + connection.getRemoteSocketAddress());
      } catch(IOException ex) {
        logger.log(Level.WARNING,
            "Error talking to " + connection.getRemoteSocketAddress(), ex);
      } finally {
        try {
          connection.close();
        } catch (IOException ex) {}
      }
    }
  }

  public static void main(String[] args) {

    int thePort;
    String theSite;

    try {
      theSite = args[0];
      // trim trailing slash
      if (theSite.endsWith("/")) {
        theSite = theSite.substring(0, theSite.length() - 1);
      }
    } catch (RuntimeException ex) {
      System.out.println(
          "Usage: java Redirector http://www.newsite.com/ port");
      return;
    }

    try {
      thePort = Integer.parseInt(args[1]);
    } catch (RuntimeException ex) {
      thePort = 80;
    }

    Redirector redirector = new Redirector(theSite, thePort);
    redirector.start();
  }
}
```

### 一个完整的 HTTP 服务器

```java
import java.io.*;
import java.net.*;
import java.util.concurrent.*;
import java.util.logging.*;

public class JHTTP {

  private static final Logger logger = Logger.getLogger(
      JHTTP.class.getCanonicalName());
  private static final int NUM_THREADS = 50;
  private static final String INDEX_FILE = "index.html";

  private final File rootDirectory;
  private final int port;

  public JHTTP(File rootDirectory, int port) throws IOException {

    if (!rootDirectory.isDirectory()) {
      throw new IOException(rootDirectory
          + " does not exist as a directory");
    }
    this.rootDirectory = rootDirectory;
    this.port = port;
  }

  public void start() throws IOException {
    ExecutorService pool = Executors.newFixedThreadPool(NUM_THREADS);
    try (ServerSocket server = new ServerSocket(port)) {
      logger.info("Accepting connections on port " + server.getLocalPort());
      logger.info("Document Root: " + rootDirectory);

      while (true) {
        try {
          Socket request = server.accept();
          Runnable r = new RequestProcessor(
              rootDirectory, INDEX_FILE, request);
          pool.submit(r);
        } catch (IOException ex) {
          logger.log(Level.WARNING, "Error accepting connection", ex);
        }
      }
    }
  }

  public static void main(String[] args) {

    // get the Document root
    File docroot;
    try {
      docroot = new File(args[0]);
    } catch (ArrayIndexOutOfBoundsException ex) {
      System.out.println("Usage: java JHTTP docroot port");
      return;
    }

    // set the port to listen on
    int port;
    try {
      port = Integer.parseInt(args[1]);
      if (port < 0 || port > 65535) port = 80;
    } catch (RuntimeException ex) {
      port = 80;
    }

    try {
      JHTTP webserver = new JHTTP(docroot, port);
      webserver.start();
    } catch (IOException ex) {
      logger.log(Level.SEVERE, "Server could not start", ex);
    }
  }
}
```

```java
//	处理HTTP请求的runnable类
import java.io.*;
import java.net.*;
import java.nio.file.Files;
import java.util.*;
import java.util.logging.*;

public class RequestProcessor implements Runnable {

  private final static Logger logger = Logger.getLogger(
      RequestProcessor.class.getCanonicalName());

  private File rootDirectory;
  private String indexFileName = "index.html";
  private Socket connection;

  public RequestProcessor(File rootDirectory,
      String indexFileName, Socket connection) {

    if (rootDirectory.isFile()) {
      throw new IllegalArgumentException(
          "rootDirectory must be a directory, not a file");
    }
    try {
      rootDirectory = rootDirectory.getCanonicalFile();
    } catch (IOException ex) {
    }
    this.rootDirectory = rootDirectory;

    if (indexFileName != null) this.indexFileName = indexFileName;
    this.connection = connection;
  }

  @Override
  public void run() {
    // for security checks
    String root = rootDirectory.getPath();
    try {
      OutputStream raw = new BufferedOutputStream(
                          connection.getOutputStream()
                         );
      Writer out = new OutputStreamWriter(raw);
      Reader in = new InputStreamReader(
                   new BufferedInputStream(
                    connection.getInputStream()
                   ),"US-ASCII"
                  );
      StringBuilder requestLine = new StringBuilder();
      while (true) {
        int c = in.read();
        if (c == '\r' || c == '\n') break;
        requestLine.append((char) c);
      }

      String get = requestLine.toString();

      logger.info(connection.getRemoteSocketAddress() + " " + get);

      String[] tokens = get.split("\\s+");
      String method = tokens[0];
      String version = "";
      if (method.equals("GET")) {
        String fileName = tokens[1];
        if (fileName.endsWith("/")) fileName += indexFileName;
        String contentType =
            URLConnection.getFileNameMap().getContentTypeFor(fileName);
        if (tokens.length > 2) {
          version = tokens[2];
        }

        File theFile = new File(rootDirectory,
            fileName.substring(1, fileName.length()));

        if (theFile.canRead()
            // Don't let clients outside the document root
            && theFile.getCanonicalPath().startsWith(root)) {
          byte[] theData = Files.readAllBytes(theFile.toPath());
          if (version.startsWith("HTTP/")) { // send a MIME header
            sendHeader(out, "HTTP/1.0 200 OK", contentType, theData.length);
          }

          // send the file; it may be an image or other binary data
          // so use the underlying output stream
          // instead of the writer
          raw.write(theData);
          raw.flush();
        } else { // can't find the file
          String body = new StringBuilder("<HTML>\r\n")
              .append("<HEAD><TITLE>File Not Found</TITLE>\r\n")
              .append("</HEAD>\r\n")
              .append("<BODY>")
              .append("<H1>HTTP Error 404: File Not Found</H1>\r\n")
              .append("</BODY></HTML>\r\n").toString();
          if (version.startsWith("HTTP/")) { // send a MIME header
            sendHeader(out, "HTTP/1.0 404 File Not Found",
                "text/html; charset=utf-8", body.length());
          }
          out.write(body);
          out.flush();
        }
      } else { // method does not equal "GET"
        String body = new StringBuilder("<HTML>\r\n")
            .append("<HEAD><TITLE>Not Implemented</TITLE>\r\n")
            .append("</HEAD>\r\n")
            .append("<BODY>")
            .append("<H1>HTTP Error 501: Not Implemented</H1>\r\n")
            .append("</BODY></HTML>\r\n").toString();
        if (version.startsWith("HTTP/")) { // send a MIME header
          sendHeader(out, "HTTP/1.0 501 Not Implemented",
                    "text/html; charset=utf-8", body.length());
        }
        out.write(body);
        out.flush();
      }
    } catch (IOException ex) {
      logger.log(Level.WARNING,
          "Error talking to " + connection.getRemoteSocketAddress(), ex);
    } finally {
      try {
        connection.close();
      }
      catch (IOException ex) {}
    }
  }

  private void sendHeader(Writer out, String responseCode,
      String contentType, int length)
      throws IOException {
    out.write(responseCode + "\r\n");
    Date now = new Date();
    out.write("Date: " + now + "\r\n");
    out.write("Server: JHTTP 2.0\r\n");
    out.write("Content-length: " + length + "\r\n");
    out.write("Content-type: " + contentType + "\r\n\r\n");
    out.flush();
  }
}
```

<div id="nio"></div>

## 非阻塞 I/O

用于减少多线程的使用，可以减少创建线程和切换线程造成的不必要的开销，使用 NIO 会增加体系结构的复杂性，使用多线程会简单很多，这很难对两者的优劣性作出判断。

非阻塞 IO 的重点就是**对缓冲区的操作、与通道搭配使用、还有**`Selector`**选择器**，即选择一个准备好的通道进行操作。

### 缓冲区 buffer

在 nio 模型中，所有数据都要进行缓存，缓冲区可能是字节数组，原始实现也可能直接将缓冲区与硬件或者内存连接。流和通道的区别是：流是一个字节一个字节读取的（即使提供了 byte[]，原理还是基于字节的），而通道是基于块的，要传送的字节必须都存放在缓冲区中。

每个缓冲区都有四个关键信息，且无论缓冲区是何种类型都提供了这四种信息的查询：

- **位置** 缓冲区中要读写的下一个位置，以 0 起始，最大值等于缓冲区大小
- **容量** 缓冲区可保存的元素最大容量
- **限度** 缓冲区当前可访问的数据的末尾位置
- **标记** 通过`mark()`可以标记当前位置 `reset()`用于清空标记

读取缓冲区不会对数据造成任何影响，只会改变缓冲区的位置。我们可以通过`allocate()`创建一个基于数组的缓冲区，**缓冲区是基于继承的，不是基于多态的**，要处理的元素如果是 IntBuffer、CharBuffer、ByteBuffer 等类型(基本类型都提供 buffer 缓存类型)，都要用某种类型的缓冲区的工厂方法来创建缓冲区，而不是使用超类 buffer。

基于数组的缓冲区可以使用`array()`&`arrayOffset()`来返回数组，但这实际上暴露了私有数据，要谨慎使用，而且在返回数组后必须二选一，即只对缓冲区或者只对数组进行操作，防止出现问题。

`allocateDirect()`可以直接分配内存区，而不基于数组，这里无法返回数组，但是和硬件或者内存联系紧密，可以大大提高数据的读写速度。

每种类型的缓冲区都提供了一些常用方法来对缓冲区进行操作：

- `clear()`将位置设为 0，并把限度设成容量，从而将缓冲区“清空”，后续数据会直接覆盖老数据
- `rewind()`将位置设成 0，但不改变限度，主要用于==写完数据后读取缓冲区==
- `flip()`将限度设置成当前位置，写完数据后方便读取。
- `hasRemaining()`&`remaining()`用于返回缓冲区当前位置和限度之间的元素数量

**填空和排出**

缓冲区是为顺序访问而设计的，每个缓冲区都有一个当前位置（`position()`），从缓冲区读取或者写入一个元素时，缓冲区的位置都为+1

- `put()` 缓冲区最多可以填充到其容量大小
- `get()` 从缓冲区读取数据，空数据则为 null(\u0000)
  - 这两个方法都有批量方法，可以用现有的字节数组或者子数组填充和排空
  - 还有绝对方法，即传入两个参数，第一个参数为 index，第二个参数为元素，绝对方法不会改变位置，因此顺序不会有影响
- 数据转换方法：`getChar() putChar() getShort() putShort()` ....

#### 视图缓冲区

如果知道从通道中读取的缓冲区中只包含一种类型的元素，则可以使用视图缓冲区，它从当前维持住开始由底层提取数据，对视图缓冲区的操作会反映到底层缓冲区，每个缓冲区都有自己独立的信息

- `public abstract ShortBuffer asShortBuffer()`
- `public abstract CharBuffer asCharBuffer()`
- `public abstract IntBuffer asIntBuffer()`
- `public abstract LongBuffer asLongBuffer()`
- `public abstract FloatBuffer asFloatBuffer()`
- `public abstract DoubleBuffer asDoubleBuffer()`

完全可以使用视图来填充和排空缓冲区，但**数据必须使用原始的**`ByteBuffer`**对通道进行读写**，通道只能读写原始类型的方法，**两个缓冲区有两套独立的信息**，必须分别考虑，而且非阻塞模式不能保证缓冲区在排空后能以 int、double、float 等类型边界对齐，**向非阻塞通道写入一个 int 的半个字节是有可能的**，在向视图放入更多数据前，应当检查这个问题

#### 压缩缓冲区

大多数缓冲区都支持`compact()`方法用来对数据进行复制前的压缩，即对缓冲区中的数据进行写出，然后剩余的数据移到缓冲区的开头，同时缓冲区的位置设成剩余数据的尾部，可以继续写入数据，这对复制很有帮助（读取一个缓冲区，写入到另一个缓冲区中）

#### 复制缓冲区

建立缓冲区副本可以用来将相同的信息发送到多个独立的通道之中，除了 long 类型，其他六种特定类型(Byte Int Char Short Float Double)缓冲区都提供了一个`duplicate()`来共享相同的数据，初始和复制缓冲区有两套独立的位置，一个缓冲区可以超强或者落后于另一缓冲区，但这个方法只用于读取数据，如果修改了共享的数据，会难以追踪数据在哪里发生了修改。

**分片缓冲区**

这六种特定类型的缓冲区还提供了一个`slice()`来提供一个分片缓冲区，即起始位置是原缓冲区的当前位置而容量是限度，子序列只能看到当前位置到限度的所有元素

#### 缓冲区的 Object 方法

`equals()`只有满足以下条件的时候才认为两个缓冲区是相等的：（<u>_`hashCode()`同理_</u>）

- 缓冲区要具有相同的类型
- 缓冲区中剩余的元素个数相同
- 相同位置上的剩余元素彼此相等

==相等性并不考虑缓冲区中位置之前的元素，也不考虑缓冲区的容量、限度和标记==

### 通道

> 通道将缓冲区的数据移入移出到各种 IO 源，如文件、socket、数据报等`
>
> 对于网络编程有三个重要的通道类：`SocketChannel ServerSocketChannel DatagramChannel`

```java
//	实例非阻塞IO的服务器
import java.nio.*;
import java.nio.channels.*;
import java.net.*;
import java.util.*;
import java.io.IOException;

public class ChargenServer {

  public static int DEFAULT_PORT = 19;

  public static void main(String[] args) {

    int port;
    try {
      port = Integer.parseInt(args[0]);
    } catch (RuntimeException ex) {
      port = DEFAULT_PORT;
    }
    System.out.println("Listening for connections on port " + port);

    byte[] rotation = new byte[95*2];
    for (byte i = ' '; i <= '~'; i++) {
      rotation[i -' '] = i;
      rotation[i + 95 - ' '] = i;
    }

    ServerSocketChannel serverChannel;
    Selector selector;
    try {
      serverChannel = ServerSocketChannel.open();
      //	可以简写为 serverChannel.bind(new InetSocketAddress(port))
      ServerSocket ss = serverChannel.socket();
      InetSocketAddress address = new InetSocketAddress(port);
      ss.bind(address);
      serverChannel.configureBlocking(false);
      selector = Selector.open();
      serverChannel.register(selector, SelectionKey.OP_ACCEPT);
    } catch (IOException ex) {
      ex.printStackTrace();
      return;
    }

    while (true) {
      try {
        selector.select();
      } catch (IOException ex) {
        ex.printStackTrace();
        break;
      }

      Set<SelectionKey> readyKeys = selector.selectedKeys();
      Iterator<SelectionKey> iterator = readyKeys.iterator();
      while (iterator.hasNext()) {

        SelectionKey key = iterator.next();
        iterator.remove();
        try {
          if (key.isAcceptable()) {
            ServerSocketChannel server = (ServerSocketChannel) key.channel();
            SocketChannel client = server.accept();
            System.out.println("Accepted connection from " + client);
            client.configureBlocking(false);
            SelectionKey key2 = client.register(selector, SelectionKey.
                                                                    OP_WRITE);
            ByteBuffer buffer = ByteBuffer.allocate(74);
            buffer.put(rotation, 0, 72);
            buffer.put((byte) '\r');
            buffer.put((byte) '\n');
            buffer.flip();
            key2.attach(buffer);
          } else if (key.isWritable()) {
            SocketChannel client = (SocketChannel) key.channel();
            ByteBuffer buffer = (ByteBuffer) key.attachment();
            if (!buffer.hasRemaining()) {
              // Refill the buffer with the next line
              buffer.rewind();
              // Get the old first character
              int first = buffer.get();
              // Get ready to change the data in the buffer
              buffer.rewind();
              // Find the new first characters position in rotation
              int position = first - ' ' + 1;
              // copy the data from rotation into the buffer
              buffer.put(rotation, position, 72);
              // Store a line break at the end of the buffer
              buffer.put((byte) '\r');
              buffer.put((byte) '\n');
              // Prepare the buffer for writing
              buffer.flip();
            }
            client.write(buffer);
          }
        } catch (IOException ex) {
          key.cancel();
          try {
            key.channel().close();
          }
          catch (IOException cex) {}
        }
      }
    }
  }
}
```

#### SocketChannel

SocketChannel 类没有任何公共构造函数，要使用两个静态`open()`方法来创建 SocketChannel 对象，使用带参数的构造器会阻塞来建立连接，使用无参版本不立即连接，它创建一个初始未连接的 socket 必须通过`connect()`才会连接，要用非阻塞方法打开通道就应该用无参构造器，在程序实际使用连接前要记得调用`finishConnect`方法来保证连接已经建立。

读取 SocketChannel，要用`pubilc abstract int read(ByteBuffer dst) throws IOException`，因此要先建立一个字节缓冲区，通道会用尽可能多的数据填充缓冲区。写入同理，Socket 通道在一般情况下都是全双工的，将通道写到多个缓冲区叫散步，而将多个缓冲区的数据写入通道叫聚集，就像正常的 Socket 一样，用完通道后要关闭，释放使用的端口和资源。

#### ServerSocketChannel

这个类只有一个目的就是为了接受入站连接，无法读取、写入或者连接 ServerSocketChannel，其`accept()`方法最重要。`ServerSocketChannel.open()`用于新建一个 ServerSocketChannel 对象，然后通过该对象的`socket()`方法获得一个 ServerSocket

```java
try	{
  ServerSocketChannel server = ServerSocketChannel.open();
  ServerSocket socket = server.socket();	//	可直接忽略，用bind方法时自动创建socket
  SocketAddress address = new SocketAddress(port)
  socket.bind(address);
}catch(IOException e){
  ....
}
```

接受连接`accept()`可以有阻塞方式和非阻塞方式执行，在非阻塞方式下，如果没有入站连接则会返回 null，非阻塞模式一般和 Selector 结合使用，设置非阻塞莫送出需要先将 ServerSocketChannel 的`configureBlocking()`传入 false

### Channels

这是一个简单的工具类，可以将基于 IO 的流、阅读器和书写器包装到通道中，同理可以反向从通道中获取流、阅读器和书写器。

### 异步通道

AsynchronousSocketChannel 和 AsynchronousServerSocketChannel 类，这两个类是读写异步通道，其会立刻返回，甚至在 IO 完成前就会返回，所读写的数据由一个 Future 或 CompletionHandler 进一步处理，这里不使用选择器

### Selector

Selector 只能通过工厂类来获得新的构造器:`Selectors.open()`

然后向选择器增加通道，`public finally SelectionKey register(Selector sel, int pos)`

sel 是要通道向哪个选择器组成，该方法是在 SelectableChannel 类中声明的，不是所有通道都是可选择的

pos 是标志整型常量，用于选择操作类型：

- SelectionKey.OP_ACCEPT
- SelectionKey.OP_CONNECT
- SelectionKey.OP_READ
- SelectionKey.OP_WRITE

还有一个重载的方法可以添加一个附件，用来附加一个流或者通道

选择就绪通道也有三个方法：

- `public abstract int selectNow() throws IOException`
  - 方法不阻塞，如果没有准备好的会立刻返回
- `public abstract int select() throws IOException`
  - 方法阻塞，一直等待到至少有通道可用
- `public abstract int select(long timeout) throws IOException`
  - 方法阻塞，等待一定时间

如果通道已经就绪可用`selectdeKeys()`来获取就绪通道，其返回一个 `Set<selectionKey>`

处理这个集合的时候可以从迭代器中删除这个键，告知选择器改键已经被处理

### SelectionKey

这个对象相当于通道的指针，一个通道可以注册到多个选择器中，获取到一个 SelectionKey 后要确定这些键能够进行什么样的操作：`isAccept() isConnectable() isReadable() isWritable()`一旦了解到相关的通道准备完成何种操作就可以用`channel()`来获取通道，获取`SelectionKey`存储的对象可以用`attachment()`方法，结束时取消连接用`cancel()`方法来撤销注册，但当关闭通道的时候会自动在所在的选择器中撤销注册，关闭选择器同理
