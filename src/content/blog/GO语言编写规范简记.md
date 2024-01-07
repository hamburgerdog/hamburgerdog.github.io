---
title: 'GO语言编写规范简记'
date: 2021-01-10 13:25:00 +0800
tags: 后端
subtitle: 'go学习笔记'
---

# GO 语言编写规范简记

> [实效 GO 语言编程](https://go-zh.org/doc/effective_go.html#%E5%90%8D%E7%A7%B0) 学习简记

## 命名

1. **包命名：**包应当以小写的单个单词来命名，且不应使用下划线或驼峰记法，包名就是导入时所需的唯一默认名称， 它并不需要在所有源码中保持唯一，即便在少数发生冲突的情况下， 也可为导入的包选择一个别名来局部使用。 无论如何，通过文件名来判定使用的包，都是不会产生混淆的。
   - `once.Do`，`once.Do(setup)` 表述足够清晰， 使用 `once.DoOrWaitUntilDone(setup)` 完全就是画蛇添足。 长命名并不会使其更具可读性。一份有用的说明文档通常比额外的长名更有价值。
   - 例如，`bufio` 包中的缓存读取器类型叫做 `Reader` 而非 `BufReader`，因为用户将它看做 `bufio.Reader`，这是个清楚而简洁的名称。 此外，由于被导入的项总是通过它们的包名来确定，因此 `bufio.Reader` 不会与 `io.Reader` 发生冲突。
   - 同样，用于创建 `ring.Ring` 的新实例的函数（这就是 Go 中的**构造函数**）一般会称之为 `NewRing`，但由于 `Ring` 是该包所导出的唯一类型，且该包也叫 `ring`，因此它可以只叫做 `New`，它跟在包的后面，就像 `ring.New`。使用包结构可以帮助你选择好的名称。
2. **获取器：**若你有个名为 `owner` （小写，未导出）的字段，其获取器应当名为 `Owner`（大写，可导出）而非 `GetOwner`。大写字母即为可导出的这种规定为区分方法和字段提供了便利。 若要提供设置器方法，`SetOwner` 是个不错的选择。
3. **接口名：**按照约定，只包含一个方法的接口应当以该方法的名称加上-er 后缀来命名，如 `Reader`、`Writer`、 `Formatter`、`CloseNotifier` 等。
4. **驼峰法：**最后，Go 中约定使用驼峰记法 `MixedCaps` 或 `mixedCaps`。

## 分号 ；

> 和 C 一样，Go 的正式语法使用分号来结束语句；和 C 不同的是，这些分号并不在源码中出现。 取而代之，词法分析器会使用一条简单的规则来自动插入分号，因此因此源码中基本就不用分号了。

规则简述为 “如果新行前的标记为语句的末尾，则插入分号”

标识符（包括 `int` 和 `float64` 这类的单词）、数值或字符串常量之类的基本字面或以下标记之一

```go
break continue fallthrough return ++ -- ) }
```

 ：无论如何，你都不应将一个控制结构（`if`、`for`、`switch` 或 `select`）的左大括号放在下一行。

## 控制结构

### 重新声明和再次赋值

在满足下列条件时，已被声明的变量 `v` 可出现在`:=` 声明中：

- 本次声明与已声明的 `v` 处于同一作用域中（若 `v` 已在外层作用域中声明过，则此次声明会创建一个新的变量§），
- **在初始化中与其类型相应的值才能赋予** `v`，且
- 在此次声明中至少另有一个变量是新声明的。

 即便 Go 中的函数形参和返回值在词法上处于大括号之外， 但它们的作用域和该函数体仍然相同。

### switch

`case` 语句会自上而下逐一进行求值直到匹配为止。若 `switch` 后面没有表达式，它将匹配 `true`，因此，我们可以将 `if-else-if-else` 链写成一个 `switch`，这也更符合 Go 的风格。`switch` 并不会自动下溯，但 `case` 可通过逗号分隔来列举相同的处理条件。

`switch` 也可用于判断接口变量的动态类型。如 **类型选择** 通过圆括号中的关键字 `type` 使用类型断言语法。若 `switch` 在表达式中声明了一个变量，那么该变量的每个子句中都将有该变量对应的类型。

```go
//	类型选择
var t interface{}
t = functionOfSomeType()
switch t := t.(type) {
default:
	fmt.Printf("unexpected type %T", t)       // %T 输出 t 是什么类型
case bool:
	fmt.Printf("boolean %t\n", t)             // t 是 bool 类型
case int:
	fmt.Printf("integer %d\n", t)             // t 是 int 类型
case *bool:
	fmt.Printf("pointer to boolean %t\n", *t) // t 是 *bool 类型
case *int:
	fmt.Printf("pointer to integer %d\n", *t) // t 是 *int 类型
}
```

尽管它们在 Go 中的用法和其它类 C 语言差不多，但 `break` 语句可以使 `switch` 提前终止。不仅是 `switch`， 有时候也必须打破层层的循环。在 Go 中，我们只需将标签放置到循环外，然后 “蹦”到那里即可。下面的例子展示了二者的用法。

```go
package main

import "fmt"

func main() {
Loop:
	for i := 1;; i++ {
		switch {
		case i == 1:
			fmt.Println(i)
			break
		case i == 2:
			fmt.Println(i)
			break

		case i == 3:
			fmt.Println(i)
			break
		default:
			fmt.Println(i)
			break Loop	//	跳出了循环
		}
	}
}

>>>>
go run test_go.go
1
2
3
4
```

## 函数 func( )

### 多值返回

Go 与众不同的特性之一就是函数和方法可返回多个值。这种形式可以改善 C 中一些笨拙的习惯： 将错误值返回（例如用 `-1` 表示 `EOF`）和修改通过地址传入的实参。

### defer

被推迟函数的实参（如果该函数为方法则还包括接收者）在**推迟**执行时就会求值， 而不是在**调用**执行时才求值。这样不仅无需担心变量值在函数执行时被改变， 同时还意味着单个已推迟的调用可推迟多个函数的执行。下面是个简单的例子。

```
for i := 0; i < 5; i++ {
	defer fmt.Printf("%d ", i)
}
```

被推迟的函数按照先进后出（LIFO）的顺序执行，因此以上代码在函数返回时会打印 `4 3 2 1 0`。

## 数据

### new 和 make 分配

`new`是个用来分配内存的内建函数， 但与其它语言中的同名函数不同，它不会**初始化**内存，只会将内存**置零**。 也就是说，`new(T)` 会为类型为 `T` 的新项分配已置零的内存空间， 并返回它的地址，也就是一个类型为 `*T` 的值。用 Go 的术语来说，它返回一个指针， 该指针指向新分配的，类型为 `T` 的零值。

内建函数 `make(T, args)` 的目的不同于 `new(T)`。它只用于创建切片、映射和信道，并返回类型为 `T`（而非 `*T`）的一个**已初始化** （而非**置零**）的值。 出现这种用差异的原因在于，这三种类型本质上为引用数据类型，它们在使用前必须初始化。 例如，切片是一个具有三项内容的描述符，包含一个指向（数组内部）数据的指针、长度以及容量， 在这三项被初始化之前，该切片为 `nil`。对于切片、映射和信道，`make` 用于初始化其内部的数据结构并准备好将要使用的值。例如，

```
make([]int, 10, 100)
```

会分配一个具有 100 个 `int` 的数组空间，接着创建一个长度为 10， 容量为 100 并指向该数组中前 10 个元素的切片结构。（生成切片时，其容量可以省略，更多信息见切片一节。） 与此相反，`new([]int)` 会返回一个指向新分配的，已置零的切片结构， 即一个指向 `nil` 切片值的指针。

下面的例子阐明了 `new` 和 `make` 之间的区别：

```
var p *[]int = new([]int)       // 分配切片结构；*p == nil；基本没用
var v  []int = make([]int, 100) // 切片 v 现在引用了一个具有 100 个 int 元素的新数组

// 没必要的复杂：
var p *[]int = new([]int)
*p = make([]int, 100, 100)

// 习惯用法：
v := make([]int, 100)
```

请记住，`make` 只适用于映射、切片和信道且不返回指针。若要获得明确的指针， 请使用 `new` 分配内存。

### ==构造函数 和 复合字面==​

有时零值还不够好，这时就需要一个初始化构造函数，如来自 `os` 包中的这段代码所示。

```go
func NewFile(fd int, name string) *File {
	if fd < 0 {
		return nil
	}
	f := new(File)
	f.fd = fd
	f.name = name
	f.dirinfo = nil
	f.nepipe = 0
	return f
}
```

这里显得代码过于冗长。我们可通过**复合字面**来简化它， 该表达式在每次求值时都会创建新的实例。

```go
func NewFile(fd int, name string) *File {
	if fd < 0 {
		return nil
	}
	f := File{fd, name, nil, 0}
	return &f
}
```

请注意，返回一个局部变量的地址完全没有问题，这点与 C 不同。该局部变量对应的数据 在函数返回后依然有效。实际上，每当获取一个复合字面的地址时，都将为一个新的实例分配内存， 因此我们可以将上面的最后两行代码合并：

```go
	return &File{fd, name, nil, 0}
```

复合字面的字段必须按顺序全部列出。但如果以 **字段**`:`**值** 对的形式明确地标出元素，初始化字段时就可以按任何顺序出现，未给出的字段值将赋予零值。 因此，我们可以用如下形式：

```go
	return &File{fd: fd, name: name}
```

少数情况下，若复合字面不包括任何字段，它将创建该类型的零值。表达式 `new(File)` 和 `&File{}` 是等价的。

复合字面同样可用于创建数组、切片以及映射，字段标签是索引还是映射键则视情况而定。 在下例初始化过程中，无论 `Enone`、`Eio` 和 `Einval` 的值是什么，只要它们的标签不同就行。

```go
a := [...]string   {Enone: "no error", Eio: "Eio", Einval: "invalid argument"}
s := []string      {Enone: "no error", Eio: "Eio", Einval: "invalid argument"}
m := map[int]string{Enone: "no error", Eio: "Eio", Einval: "invalid argument"}
```

### 数组 [...]

主要用作切片的构件，在 Go 中，

- 数组是值。将一个数组赋予另一个数组会复制其所有元素。
- 特别地，若将某个数组传入某个函数，它将接收到该数组的一份**副本**而非指针。
- 数组的大小是其类型的一部分。类型 `[10]int` 和 `[20]int` 是不同的。

数组为值的属性很有用，但代价高昂；若你想要 C 那样的行为和效率，你可以传递一个指向该数组的指针。

### 切片 [:]

切片保存了对底层数组的引用，若你将某个切片赋予另一个切片，它们会引用同一个数组。 若某个函数将一个切片作为参数传入，则它对该切片元素的修改对调用者而言同样可见， 这可以理解为传递了底层数组的指针。只要切片不超出底层数组的限制，它的长度就是可变的，只需将它赋予其自身的切片即可

#### 二维切片 [:] [:]

一种就是独立地分配每一个切片；而另一种就是只分配一个数组， 将各个切片都指向它。采用哪种方式取决于你的应用。若切片会增长或收缩， 就应该通过独立分配来避免覆盖下一行；若不会，用单次分配来构造对象会更加高效。 以下是这两种方法的大概代码，仅供参考。首先是一次一行的：

```go
// 分配顶层切片。
picture := make([][]uint8, YSize) // 每 y 个单元一行。
// 遍历行，为每一行都分配切片
for i := range picture {
	picture[i] = make([]uint8, XSize)
}
```

现在是一次分配，对行进行切片：

```go
// 分配顶层切片，和前面一样。
picture := make([][]uint8, YSize) // 每 y 个单元一行。
// 分配一个大的切片来保存所有像素
pixels := make([]uint8, XSize*YSize) // 拥有类型 []uint8，尽管图片是 [][]uint8.
// 遍历行，从剩余像素切片的前面切出每行来。
for i := range picture {
	picture[i], pixels = pixels[:XSize], pixels[XSize:]
}
```

### 映射 map[key T] value T

映射的键可以是任何相等性操作符支持的类型， 如整数、浮点数、复数、字符串、指针、接口（只要其动态类型支持相等性判断）、结构以及数组。 切片不能用作映射键，因为它们的相等性还未定义。与切片一样，映射也是引用类型。 若将映射传入函数中，并更改了该映射的内容，则此修改对调用者同样可见。

若试图通过映射中不存在的键来取值，就会返回与该映射中项的类型对应的零值。 例如，若某个映射包含整数，当查找一个不存在的键时会返回 `0`。有时你需要区分某项是不存在还是其值为零值。如对于一个值本应为零的 `"UTC"` 条目，也可能是由于不存在该项而得到零值。你可以使用多重赋值的形式来分辨这种情况。

```go
var seconds int
var ok bool
seconds, ok = timeZone[tz]
```

要删除映射中的某项，可使用内建函数 `delete`，它以映射及要被删除的键为实参。 即便对应的键不在该映射中，此操作也是安全的。

```go
delete(timeZone, "PDT")  // 现在用标准时间
```

### 打印

#### `fmt.Printf()`

若你只想要默认的转换，如使用十进制的整数，你可以使用通用的格式 `%v`（对应“值”）；其结果与 `Print` 和 `Println` 的输出完全相同。此外，这种格式还能打印**任意**值，甚至包括数组、结构体和映射。 以下是打印上一节中定义的时区映射的语句。

```go
fmt.Printf("%v\n", timeZone)  // 或只用 fmt.Println(timeZone)
```

这会输出

```go
map[CST:-21600 PST:-28800 EST:-18000 UTC:0 MST:-25200]
```

当然，映射中的键可能按任意顺序输出。当打印结构体时，改进的格式 `%+v` 会为结构体的每个字段添上字段名，而另一种格式 `%#v` 将完全按照 Go 的语法打印值。

```go
type T struct {
	a int
	b float64
	c string
}
t := &T{ 7, -2.35, "abc\tdef" }
fmt.Printf("%v\n", t)
fmt.Printf("%+v\n", t)
fmt.Printf("%#v\n", t)
fmt.Printf("%#v\n", timeZone)
>>>>>
&{7 -2.35 abc   def}
&{a:7 b:-2.35 c:abc     def}
&main.T{a:7, b:-2.35, c:"abc\tdef"}
map[string] int{"CST":-21600, "PST":-28800, "EST":-18000, "UTC":0, "MST":-25200}
```

另一种实用的格式是 `%T`，它会打印某个值的**类型**。

#### `fmt.Sprintf()`

若你想控制自定义类型的默认格式，只需为该类型定义一个具有 `String() string` 签名的方法。请勿通过调用 `Sprintf` 来构造 `String` 方法，因为它会无限递归你的的 `String` 方法。

```go
type MyString string

func (m MyString) String() string {
	return fmt.Sprintf("MyString=%s", m) // 错误：会无限递归
}
```

### 追加

`append` 会在切片末尾追加元素并返回结果。我们必须返回结果， 原因与我们手写的 `Append` 一样，即底层数组可能会被改变。但如果我们要像 `Append` 那样将一个切片追加到另一个切片中呢？ 很简单：在调用的地方使用 `...`，就像我们在上面调用 `Output` 那样。以下代码片段的输出与上一个相同。

```go
x := []int{1,2,3}
y := []int{4,5,6}
x = append(x, y...)
fmt.Println(x)
```

如果没有 `...`，它就会由于类型错误而无法编译，因为 `y` 不是 `int` 类型的。

## 初始化

最后，每个源文件都可以通过定义自己的无参数 `init` 函数来设置一些必要的状态。 （其实每个文件都可以拥有多个 `init` 函数。）而它的结束就意味着初始化结束： 只有该包中的所有变量声明都通过它们的初始化器求值后 `init` 才会被调用， 而那些 `init` 只有在所有已导入的包都被初始化后才会被求值。

==除了那些不能被表示成声明的初始化外，`init` 函数还常被用在程序真正开始执行前，检验或校正程序的状态。==

## 指针 Vs 值 \*

以指针或值为接收者的区别在于：值方法可通过指针和值调用， 而指针方法只能通过指针来调用。但若该值是可寻址的， 那么该语言就会自动插入取址操作符来对付一般的通过值调用的指针方法。在我们的例子中，变量 `b` 是可寻址的，因此我们只需通过 `b.Write` 来调用它的 `Write` 方法，编译器会将它重写为 `(&b).Write`。

## 接口 与 其他类型 T

### 类型断言

若我们知道该值拥有一个 `string` 而想要提取它呢？ 只需一种情况的类型选择就行，但它需要**类型断言**。类型断言接受一个接口值， 并从中提取指定的明确类型的值。其语法借鉴自类型选择开头的子句，但它需要一个明确的类型， 而非 `type` 关键字：

```go
var value interface{} // 调用者提供的值。
value.(typeName)
```

而其结果则是拥有静态类型 `typeName` 的新值。该类型必须为该接口所拥有的具体类型， 或者该值可转换成的第二种接口类型。要提取我们知道在该值中的字符串，可以这样：

```go
str := value.(string)
```

但若它所转换的值中不包含字符串，该程序就会以运行时错误崩溃。为避免这种情况， 需使用“逗号, ok”惯用测试它能安全地判断该值是否为字符串：

```go
str, ok := value.(string)
if ok {
	fmt.Printf("字符串值为 %q\n", str)
} else {
	fmt.Printf("该值非字符串\n")
}
```

==若类型断言失败，`str` 将继续存在且为字符串类型，但它将拥有零值，即空字符串。==

### 通用性 

若某种现有的类型仅实现了一个接口，且除此之外并无可导出的方法，则该类型本身就无需导出。 仅导出该接口能让我们更专注于其行为而非实现，其它属性不同的实现则能镜像该原始类型的行为。 这也能够避免为每个通用接口的实例重复编写文档。

在这种情况下，构造函数应当返回一个接口值而非实现的类型。例如在 `hash` 库中，`crc32.NewIEEE` 和 `adler32.New` 都返回接口类型 `hash.Hash32`。要在 Go 程序中用 Adler-32 算法替代 CRC-32， 只需修改构造函数调用即可，其余代码则不受算法改变的影响。

可理解为 Java 中的多态，即返回父接口类型，用于屏蔽不同子类实现的通用方法的差异

### 接口和方法

我们可以为除指针和接口以外的任何类型定义方法，同样也能为一个函数写一个方法。 `http` 包包含以下代码：

```go
// HandlerFunc 类型是一个适配器，它允许将普通函数用做HTTP处理程序。
// 若 f 是个具有适当签名的函数，HandlerFunc(f) 就是个调用 f 的处理程序对象。
type HandlerFunc func(ResponseWriter, *Request)

// ServeHTTP calls f(c, req).
func (f HandlerFunc) ServeHTTP(w ResponseWriter, req *Request) {
	f(w, req)
}
```

`HandlerFunc` 是个具有 `ServeHTTP` 方法的类型， 因此该类型的值就能处理 HTTP 请求。我们来看看该方法的实现：接收者是一个函数 `f`，而该方法调用 `f`。这看起来很奇怪，但不必大惊小怪， 区别在于接收者变成了一个信道，而方法通过该信道发送消息。

为了将 `ArgServer` 实现成 HTTP 服务器，首先我们得让它拥有合适的签名。

```go
// 实参服务器。
func ArgServer(w http.ResponseWriter, req *http.Request) {
	fmt.Fprintln(w, os.Args)
}
```

`ArgServer` 和 `HandlerFunc` 现在拥有了相同的签名， 因此我们可将其转换为这种类型以访问它的方法，就像我们将 `Sequence` 转换为 `IntSlice` 以访问 `IntSlice.Sort` 那样。 建立代码非常简单：

```go
http.Handle("/args", http.HandlerFunc(ArgServer))
```

当有人访问 `/args` 页面时，安装到该页面的处理程序就有了值 `ArgServer` 和类型 `HandlerFunc`。 HTTP 服务器会以 `ArgServer` 为接收者，调用该类型的 `ServeHTTP` 方法，它会反过来调用 `ArgServer`（通过 `f(c, req)`），接着实参就会被显示出来。

## 空白标识符 \_

### 用于在调试时避免编译错误

要让编译器停止关于未使用导入的抱怨，需要空白标识符来引用已导入包中的符号。
同样，将未使用的变量 `fd` 赋予空白标识符也能关闭未使用变量错误。 该程序的以下版本可以编译。

```go
package main

import (
    "fmt"
    "io"
    "log"
    "os"
)

var _ = fmt.Printf // For debugging; delete when done. // 用于调试，结束时删除。
var _ io.Reader    // For debugging; delete when done. // 用于调试，结束时删除。

func main() {
    fd, err := os.Open("test.go")
    if err != nil {
        log.Fatal(err)
    }
    // TODO: use fd.
    _ = fd
}
```

按照惯例，我们应在导入并加以注释后，再使全局声明导入错误静默，这样可以让它们更易找到， 并作为以后清理它的提醒。

## **==内嵌==**

Go 并不提供典型的，类型驱动的子类化概念，但通过将类型<**内嵌**到结构体或接口中， 它就能“借鉴”部分实现。

接口内嵌非常简单。我们之前提到过 `io.Reader` 和 `io.Writer` 接口，这里是它们的定义。

```go
type Reader interface {
	Read(p []byte) (n int, err error)
}

type Writer interface {
	Write(p []byte) (n int, err error)
}
```

`io` 包也导出了一些其它接口，以此来阐明对象所需实现的方法。 例如 `io.ReadWriter` 就是个包含 `Read` 和 `Write` 的接口。我们可以通过显示地列出这两个方法来指明 `io.ReadWriter`， 但通过将这两个接口内嵌到新的接口中显然更容易且更具启发性，就像这样：

```go
// ReadWriter 接口结合了 Reader 和 Writer 接口。
type ReadWriter interface {
	Reader
	Writer
}
```

正如它看起来那样：`ReadWriter` 能够做任何 `Reader` **和** `Writer` 可以做到的事情，它是内嵌接口的联合体 （它们必须是不相交的方法集）。只有接口能被嵌入到接口中。

同样的基本想法可以应用在结构体中，但其意义更加深远。`bufio` 包中有 `bufio.Reader` 和 `bufio.Writer` 这两个结构体类型， 它们每一个都实现了与 `io` 包中相同意义的接口。此外，`bufio` 还通过结合 `reader/writer` 并将其内嵌到结构体中，实现了带缓冲的 `reader/writer`：它列出了结构体中的类型，但并未给予它们字段名。

```go
// ReadWriter 存储了指向 Reader 和 Writer 的指针。
// 它实现了 io.ReadWriter。
type ReadWriter struct {
	*Reader  // *bufio.Reader
	*Writer  // *bufio.Writer
}
```

内嵌的元素为指向结构体的指针，当然它们在使用前必须被初始化为指向有效结构体的指针。 `ReadWriter` 结构体和通过如下方式定义：

```go
type ReadWriter struct {
	reader *Reader
	writer *Writer
}
```

但为了提升该字段的方法并满足 `io` 接口，我们同样需要提供转发的方法， 就像这样：

```go
func (rw *ReadWriter) Read(p []byte) (n int, err error) {
	return rw.reader.Read(p)
}
```

而通过直接内嵌结构体，我们就能避免如此繁琐。 内嵌类型的方法可以直接引用，这意味着 `bufio.ReadWriter` 不仅包括 `bufio.Reader` 和 `bufio.Writer` 的方法，它还同时满足下列三个接口： `io.Reader`、`io.Writer` 以及 `io.ReadWriter`。

还有种区分内嵌与子类的重要手段。当内嵌一个类型时，该类型的方法会成为外部类型的方法， 但当它们被调用时，该方法的接收者是内部类型，而非外部的。在我们的例子中，当 `bufio.ReadWriter` 的 `Read` 方法被调用时， 它与之前写的转发方法具有同样的效果；接收者是 `ReadWriter` 的 `reader` 字段，而非 `ReadWriter` 本身。

内嵌同样可以提供便利。这个例子展示了一个内嵌字段和一个常规的命名字段。

```go
type Job struct {
	Command string
	*log.Logger
}
```

`Job` 类型现在有了 `Log`、`Logf` 和 `*log.Logger` 的其它方法。我们当然可以为 `Logger` 提供一个字段名，但完全不必这么做。现在，一旦初始化后，我们就能记录 `Job` 了：

```go
job.Log("starting now...")
```

`Logger` 是 `Job` 结构体的常规字段， 因此我们可在 `Job` 的构造函数中，通过一般的方式来初始化它，就像这样：

```go
func NewJob(command string, logger *log.Logger) *Job {
	return &Job{command, logger}
}
```

或通过复合字面：

```go
job := &Job{command, log.New(os.Stderr, "Job: ", log.Ldate)}
```

若我们需要直接引用内嵌字段，可以忽略包限定名，直接将该字段的类型名作为字段名， 就像我们在 `ReaderWriter` 结构体的 `Read` 方法中做的那样。 若我们需要访问 `Job` 类型的变量 `job` 的 `*log.Logger`， 可以直接写作 `job.Logger`。若我们想精炼 `Logger` 的方法时， 这会非常有用。

```go
func (job *Job) Logf(format string, args ...interface{}) {
	job.Logger.Logf("%q: %s", job.Command, fmt.Sprintf(format, args...))
}
```

内嵌类型会引入命名冲突的问题，但解决规则却很简单。首先，字段或方法 `X` 会隐藏该类型中更深层嵌套的其它项 `X`。若 `log.Logger` 包含一个名为 `Command` 的字段或方法，`Job` 的 `Command` 字段会覆盖它。

其次，若相同的嵌套层级上出现同名冲突，通常会产生一个错误。若 `Job` 结构体中包含名为 `Logger` 的字段或方法，再将 `log.Logger` 内嵌到其中的话就会产生错误。然而，若重名永远不会在该类型定义之外的程序中使用，那就不会出错。 这种限定能够在外部嵌套类型发生修改时提供某种保护。 因此，就算添加的字段与另一个子类型中的字段相冲突，只要这两个相同的字段永远不会被使用就没问题。

## 并发

> 不要通过共享内存来通信，而应通过通信来共享内存。

### 信道 <-

尽管只有 `MaxOutstanding` 个 Go 程能同时运行，但 `Serve` 还是为每个进入的请求都创建了新的 Go 程。其结果就是，若请求来得很快， 该程序就会无限地消耗资源。为了弥补这种不足，我们可以通过修改 `Serve` 来限制创建 Go 程，这是个明显的解决方案，但要当心我们修复后出现的 Bug。

```go
func Serve(queue chan *Request) {
	for req := range queue {
		sem <- 1
		go func() {
			process(req) // 这儿有Bug，解释见下。
			<-sem
		}()
	}
}
```

Bug 出现在 Go 的 `for` 循环中，该循环变量在每次迭代时会被重用，因此 `req` 变量会在所有的 Go 程间共享，这不是我们想要的。我们需要确保 `req` 对于每个 Go 程来说都是唯一的。有一种方法能够做到，就是将 `req` 的值作为实参传入到该 Go 程的闭包中：

```go
func Serve(queue chan *Request) {
	for req := range queue {
		sem <- 1
		go func(req *Request) {
			process(req)
			<-sem
		}(req)
	}
}
```

比较前后两个版本，观察该闭包声明和运行中的差别。 另一种解决方案就是以相同的名字创建新的变量，如例中所示：

```go
func Serve(queue chan *Request) {
	for req := range queue {
		req := req // 为该Go程创建 req 的新实例。
		sem <- 1
		go func() {
			process(req)
			<-sem
		}()
	}
}
```

### 并行化

这些设计的另一个应用是在多 CPU 核心上实现并行计算。如果计算过程能够被分为几块 可独立执行的过程，它就可以在每块计算结束时向信道发送信号，从而实现并行处理。

让我们看看这个理想化的例子。我们在对一系列向量项进行极耗资源的操作， 而每个项的值计算是完全独立的。

```go
type Vector []float64

// 将此操应用至 v[i], v[i+1] ... 直到 v[n-1]
func (v Vector) DoSome(i, n int, u Vector, c chan int) {
	for ; i < n; i++ {
		v[i] += u.Op(v[i])
	}
	c <- 1    // 发信号表示这一块计算完成。
}
```

我们在循环中启动了独立的处理块，每个 CPU 将执行一个处理。 它们有可能以乱序的形式完成并结束，但这没有关系； 我们只需在所有 Go 程开始后接收，并统计信道中的完成信号即可。

```go
const NCPU = 4  // CPU核心数

func (v Vector) DoAll(u Vector) {
	c := make(chan int, NCPU)  // 缓冲区是可选的，但明显用上更好
	for i := 0; i < NCPU; i++ {
		go v.DoSome(i*len(v)/NCPU, (i+1)*len(v)/NCPU, u, c)
	}
	// 排空信道。
	for i := 0; i < NCPU; i++ {
		<-c    // 等待任务完成
	}
	// 一切完成。
}
```

目前 Go 运行时的实现默认并不会并行执行代码，它只为用户层代码提供单一的处理核心。 任意数量的 Go 程都可能在系统调用中被阻塞，而**在任意时刻默认只有一个会执行用户层代码**。 它应当变得更智能，而且它将来肯定会变得更智能。但现在，若你希望 CPU 并行执行， 就必须告诉运行时你希望同时有多少 Go 程能执行代码。有两种途径可意识形态，要么 在运行你的工作时将 `GOMAXPROCS` 环境变量设为你要使用的核心数， 要么导入 `runtime` 包并调用 `runtime.GOMAXPROCS(NCPU)`。 `runtime.NumCPU()` 的值可能很有用，它会返回当前机器的逻辑 CPU 核心数。 当然，随着调度算法和运行时的改进，将来会不再需要这种方法。

> 注意不要混淆并发和并行的概念：并发是用可独立执行的组件构造程序的方法， 而并行则是为了效率在多 CPU 上平行地进行计算。尽管 Go 的并发特性能够让某些问题更易构造成并行计算， 但**Go 仍然是种并发而非并行的语言**，且**Go 的模型并不适合所有的并行问题**。 关于其中区别的讨论，见 [此博文](http://blog.golang.org/2013/01/concurrency-is-not-parallelism.html)。

## 错误

### Error

错误字符串应尽可能地指明它们的来源，例如产生该错误的包名前缀。例如在 `image` 包中，由于未知格式导致解码错误的字符串为“image: unknown format”。

`os.Open` 可返回一个 `os.PathError`。

```go
// PathError 记录一个错误以及产生该错误的路径和操作。
type PathError struct {
	Op string    // "open"、"unlink" 等等。
	Path string  // 相关联的文件。
	Err error    // 由系统调用返回。
}

func (e *PathError) Error() string {
	return e.Op + " " + e.Path + ": " + e.Err.Error()
}

>>>>
open /etc/passwx: no such file or directory
```

这种错误包含了出错的文件名、操作和触发的操作系统错误，这样在产生该错误的调用和输出的错误信息相距甚远时，它也会非常有用，这比苍白的“不存在该文件或目录”更具说明性。

### Panic

如果错误时不可恢复的呢？有时程序就是不能继续运行。为此，我们提供了内建的 `panic` 函数，它会产生一个运行时错误并终止程序，该函数接受一个任意类型的实参（一般为字符串），并在程序终止时打印。 它还能表明发生了意料之外的事情，比如从无限循环中退出了。

实际的库函数应避免 `panic`。若问题可以被屏蔽或解决， 最好就是让程序继续运行而不是终止整个程序。一个可能的反例就是初始化： 若某个库真的不能让自己工作，且有足够理由产生 Panic，那就由它去吧。

### Recover

> 当 `panic` 被调用后（包括不明确的运行时错误，例如切片检索越界或类型断言失败）， 程序将立刻终止当前函数的执行，并开始回溯 Go 程的栈，运行任何被推迟的函数。 若回溯到达 Go 程栈的顶端，程序就会终止。**不过我们可以用内建的 `recover` 函数来重新或来取回 Go 程的控制权限并使其恢复正常执行。**

调用 `recover` 将停止回溯过程，并返回传入 `panic` 的实参。 由于在回溯时只有被推迟函数中的代码在运行，因此 `recover` 只能在被推迟的函数中才有效。

`recover` 的一个应用就是在服务器中终止失败的 Go 程而无需杀死其它正在执行的 Go 程。

```go
func server(workChan <-chan *Work) {
	for work := range workChan {
		go safelyDo(work)
	}
}

func safelyDo(work *Work) {
	defer func() {
		if err := recover(); err != nil {
			log.Println("work failed:", err)
		}
	}()
	do(work)
}
```

在此例中，若 `do(work)` 触发了 Panic，其结果就会被记录， 而该 Go 程会被干净利落地结束，不会干扰到其它 Go 程。我们无需在推迟的闭包中做任何事情， `recover` 会处理好这一切。

以下是一个 `error` 类型的 `Error` 方法和一个 `Compile` 函数的定义：

```go
// Error 是解析错误的类型，它满足 error 接口。
type Error string
func (e Error) Error() string {
	return string(e)
}

// error 是 *Regexp 的方法，它通过用一个 Error 触发Panic来报告解析错误。
func (regexp *Regexp) error(err string) {
	panic(Error(err))
}

// Compile 返回该正则表达式解析后的表示。
func Compile(str string) (regexp *Regexp, err error) {
	regexp = new(Regexp)
	// doParse will panic if there is a parse error.
	defer func() {
		if e := recover(); e != nil {
			regexp = nil    // 清理返回值。
			err = e.(Error) // 若它不是解析错误，将重新触发Panic。
		}
	}()
	return regexp.doParse(str), nil
}
```

若 `doParse` 触发了 Panic，恢复块会将返回值设为 `nil` ，**即被推迟的函数能够修改已命名的返回值**。在 `err` 的赋值过程中， 我们将通过断言它是否拥有局部类型 `Error` 来检查它。**若它没有， 类型断言将会失败，此时会产生运行时错误，并继续栈的回溯，仿佛一切从未中断过一样。** 该检查意味着若发生了一些像索引越界之类的意外，那么即便我们使用了 `panic` 和 `recover` 来处理解析错误，代码仍然会失败。

## 一个 Web 服务器

> 一个 Web 服务器。该程序其实只是个 Web 服务器的重用。 Google 在[http://chart.apis.google.com](http://chart.apis.google.com/) 上提供了一个将表单数据自动转换为图表的服务。不过，该服务很难交互， 因为你需要将数据作为查询放到 URL 中。

此程序为一种数据格式提供了更好的的接口： **给定一小段文本，它将调用图表服务器来生成二维码（QR 码）**，这是一种编码文本的点格矩阵。 该图像可被你的手机摄像头捕获，并解释为一个字符串，比如 URL， 这样就免去了你在狭小的手机键盘上键入 URL 的麻烦。

以下为完整的程序，随后有一段解释。

```go
package main

import (
    "flag"
    "html/template"
    "log"
    "net/http"
)

var addr = flag.String("addr", ":1718", "http service address") // Q=17, R=18

var templ = template.Must(template.New("qr").Parse(templateStr))

func main() {
    flag.Parse()
    http.Handle("/", http.HandlerFunc(QR))
    err := http.ListenAndServe(*addr, nil)
    if err != nil {
        log.Fatal("ListenAndServe:", err)
    }
}

func QR(w http.ResponseWriter, req *http.Request) {
    templ.Execute(w, req.FormValue("s"))
}

const templateStr = `
<html>
<head>
<title>QR Link Generator</title>
</head>
<body>
{{if .}}
<img src="http://chart.apis.google.com/chart?chs=300x300&cht=qr&choe=UTF-8&chl={{.}}" />
<br>
{{.}}
<br>
<br>
{{end}}
<form action="/" name=f method="GET"><input maxLength=1024 size=70
name=s value="" title="Text to QR Encode"><input type=submit
value="Show QR" name=qr>
</form>
</body>
</html>
`
```

`main` 之前的代码应该比较容易理解。我们通过一个标志为服务器设置了默认端口。 模板变量 `templ` 正式有趣的地方。它构建的 HTML 模版将会被服务器执行并显示在页面中。 稍后我们将详细讨论。

`main` 函数解析了参数标志并使用我们讨论过的机制将 `QR` 函数绑定到服务器的根路径。然后调用 `http.ListenAndServe` 启动服务器；它将在服务器运行时处于阻塞状态。

`QR` 仅接受包含表单数据的请求，并为表单值 `s` 中的数据执行模板。

模板包 `html/template` 非常强大；该程序只是浅尝辄止。 本质上，它通过在运行时将数据项中提取的元素（在这里是表单值）传给 `templ.Execute` 执行因而重写了 HTML 文本。 在模板文本（`templateStr`）中，双大括号界定的文本表示模板的动作。 从 `{{if .}}` 到 `{{end}}` 的代码段仅在当前数据项（这里是点 `.`）的值非空时才会执行。 也就是说，当字符串为空时，此部分模板段会被忽略。

其中两段 `{{.}}` 表示要将数据显示在模板中 （即将查询字符串显示在 Web 页面上）。HTML 模板包将自动对文本进行转义， 因此文本的显示是安全的。

余下的模板字符串只是页面加载时将要显示的 HTML。

## 内存 goroutine

> Go 内存模型阐明了一个 Go 程对某变量的写入，如何才能确保被另一个读取该变量的 Go 程监测到。

** 程序在修改被多个 Go 程同时访问的数据时必须序列化该访问。**

**要序列化访问，需通过信道操作，或其它像 [`sync`](https://go-zh.org/pkg/sync/) 和 [`sync/atomic`](https://go-zh.org/pkg/sync/atomic/) 包中的同步原语来保护数据。**

### 事件发生的次序

**在单个 Go 程中，读取和写入的表现必须与程序指定的执行顺序相一致。**换言之， 仅在不会改变语言规范对 Go 程行为的定义时，编译器和处理器才会对读取和写入的执行重新排序。 由于存在重新排序，一个 Go 程监测到的执行顺序可能与另一个 Go 程监到的不同。例如，若一个 Go 程执行 `a = 1; b = 2;`，另一个 Go 程可能监测到 `b` 的值先于 `a` 更新。

为了详细论述读取和写入的必要条件，我们定义了**事件发生顺序**，它表示 Go 程序中内存操作执行的 [偏序关系](http://zh.wikipedia.org/wiki/偏序关系)。 若事件 _e1_ 发生在 _e2_ 之前， 那么我们就说 _e2_ 发生在 _e1_ 之后。 换言之，若 _e1_ 既未发生在 _e2_ 之前， 又未发生在 _e2_ 之后，那么我们就说 _e1_ 与 _e2_ 是并发的。

在单一 Go 程中，事件发生的顺序即为程序所表达的顺序。

若以下条件均成立，则对变量 `v` 的读取操作 _r_ 就**允许**对 `v` 的写入操作 _w_ 进行监测：

1. _r_ 不发生在 _w_ 之前。
2. 在 _w_ 之后 _r_ 之前，不存在其它对 `v` 进行的写入操作 _w'_。

为确保对变量 `v` 的读取操作 _r_ 能够监测到特定的对 `v` 进行写入的操作 _w_，需确保 _w_ 是唯一允许被 _r_ 监测的写入操作。也就是说，若以下条件均成立，则 _r_ 能**保证**监测到 _w_：

1. _w_ 发生在 _r_ 之前。
2. 对共享变量 `v` 的其它任何写入操作都只能发生在 _w_ 之前或 _r_ 之后。

这对条件的要求比第一对更强，它需要确保没有其它写入操作与 _w_ 或 _r_ 并发。

在单个 Go 程中并不存在并发，因此这两条定义是等价的：读取操作 _r_ 可监测最近的写入操作 _w_ 对 `v` 写入的值。当多个 Go 程访问共享变量 `v` 时，它们必须通过同步事件来建立发生顺序的条件，以此确保读取操作能监测到预期的写入。

以变量 `v` 所属类型的零值来对 `v` 进行初始化，其表现如同在内存模型中进行的写入操作。

对大于单个机器字的值进行读取和写入，其表现如同以不确定的顺序对多个机器字大小的值进行操作。

> 译注(Ants Arks)：
> **a 不在 b 之前，并不意味着 a 就在 b 之后，它们可以并发。这样的话，第一种说法， 即对于两个并发的 Go 程来说，一个 Go 程能否读到另一个 Go 程写入的数据，可能有，也可能没有。 第二种说法，由于 r 发生在 w 之后，r 之前并没有其它的 w'，也没有 w" 和 r 并列，因此 r 读到的值必然是 w 写入的值。下面结合图形进行说明，其中 r 为 read，w 为 write，它们都对值进行操作.**

```txt
单Go程的情形：
-- w0 ---- r1 -- w1 ---- w2 ----  r2 ---- r3 ------>

这里不仅是个偏序关系，还是一个良序关系：所有 r/w 的先后顺序都是可比较的。

双Go程的情形：
-- w0 -- r1 -- r2 ---- w3 ----  w4 ---- r5 -------->
-- w1 ----- w2 -- r3 ----  r4 ---- w5 -------->

单Go程上的事件都有先后顺序；而对于两条Go程，情况又有所不同。即便在时间上 r1 先于 w2 发生，
但由于每条Go程的执行时长都像皮筋一样伸缩不定，因此二者在逻辑上并无先后次序。换言之，即二者并发。
对于并发的 r/w，r3 读取的结果可能是前面的 w2，也可能是上面的 w3，甚至 w4 的值；
而 r5 读取的结果，可能是 w4 的值，也能是 w1、w2、w5 的值，但不可能是 w3 的值。


双Go程交叉同步的情形：
-- r0 -- r1 ---|------ r2 ------------|-- w5 ------>
-- w1 --- w2 --|-- r3 ---- r4 -- w4 --|------->

现在上面添加了两个同步点，即 | 处。这样的话，r3 就是后于 r1 ，先于 w5 发生的。
r2 之前的写入为 w2，但与其并发的有 w4，因此 r2 的值是不确定的：可以是 w2，也可以是 w4。
而 r4 之前的写入的是 w2，与它并发的并没有写入，因此 r4 读取的值为 w2。
```

到这里，Go 程间的关系就很清楚了。若不加同步控制，那么所有的 Go 程都是“平行”并发的。换句话说， **若不进行同步，那么 main 函数以外的 Go 程都是无意义的，因为这样可以认为 main 跟它们没有关系。** 只有加上同步控制，例如锁或信道，Go 程间才有了相同的“节点”，在它们的两边也就有了执行的先后顺序， 不过两个“节点”之间的部分，同样还是可以自由伸缩，没有先后顺序的。如此推广，多条 Go 程的同步就成了有向的网。

### 同步 sync

#### 初始化

程序的初始化运行在单个 Go 程中，但该 Go 程可能会创建其它并发运行的 Go 程。

若包 `p` 导入了包 `q`，则 `q` 的 `init` 函数会在 `p` 的任何函数启动前完成。

函数 `main.main` 会在所有的 `init` 函数结束后启动。

#### go 程的销毁

Go 程无法确保在程序中的任何事件发生之前退出。例如，在此程序中：

```go
var a string

func hello() {
	go func() { a = "hello" }()
	print(a)
}
```

对 `a` 进行赋值后并没有任何同步事件，因此它无法保证被其它任何 Go 程检测到。 实际上，一个积极的编译器可能会删除整条 `go` 语句。

**若一个 Go 程的作用必须被另一个 Go 程监测到，需使用锁或信道通信之类的同步机制来建立顺序关系。**

#### 信道通信

- **信道上的发送操作总在对应的接收操作完成前发生。**

```go
var c = make(chan int, 10)
var a string

func f() {
	a = "hello, world"
	c <- 0
}

func main() {
	go f()
	<-c
	print(a)
}
>>>
//	hello, world
```

该程序首先对 `a` 进行写入， 然后在 `c` 上发送信号，随后从 `c` 接收对应的信号，最后执行 `print` 函数。**若在信道关闭后从中接收数据，接收者就会收到该信道返回的零值。**

- **从无缓冲信道进行的接收，要发生在对该信道进行的发送完成之前。**

此程序（<u>_与上面的相同，但交换了发送和接收语句的位置，且使用无缓冲信道_</u>）:

```go
var c = make(chan int)
var a string

func f() {
	a = "hello, world"
	<-c
}
func main() {
	go f()
	c <- 0
	print(a)
}
>>>
//	hello,world
```

若该信道为带缓冲的（例如，`c = make(chan int, 1)`）， 则该程序将无法保证打印出 `"hello, world"`。（它可能会打印出空字符串， 崩溃，或做些别的事情。）

#### 锁 

- **对于任何** `sync.Mutex` **或** `sync.RWMutex` **类型的变量** `l` **以及** _n_ **<** _m_ **，对** `l.Unlock()` **的第** _n_ **次调用在对** `l.Lock()` **的第** _m_ **次调用返回前发生。**
- **对于任何** `sync.RWMutex` **类型的变量** `l` **对** `l.RLock` **的调用，存在一个这样的** \*n**\*，使得** `l.RLock` **在对** `l.Unlock` **的第** _n_ **次调用之后发生（返回），且与其相匹配的** `l.RUnlock` **在对** `l.Lock`**的第** _n+1_ **次调用之前发生。**

#### Once 类型 

`sync` 包通过 `Once` 类型为存在多个 Go 程的初始化提供了安全的机制。 多个线程可为特定的 `f` 执行 `once.Do(f)`，**但只有一个会运行 `f()`，而其它调用会一直阻塞，直到 `f()` 返回。**

通过 `once.Do(f)` 对 `f()` 的单次调用在对任何其它的 `once.Do(f)` 调用返回之前发生（返回）。

在此程序中：

```go
var a string
var once sync.Once

func setup() {
	a = "hello, world"
}

func doprint() {
	once.Do(setup)
	print(a)
}

//   第一次对 twoprint 的调用会运行一次 setup()
func twoprint() {
	go doprint()
	go doprint()
}
>>>
/*
hello,world
hello,world
*/
```

### 错误的同步

请注意，读取操作 _r_ 可能监测到与其并发的写入操作 _w_ 写入的值。即便如此，也并不意味着发生在 _r_ 之后的读取操作会监测到发生在 _w_ 之前的写入操作。

在此程序中：

```go
var a, b int

func f() {
	a = 1
	b = 2
}

func g() {
	print(b)
	print(a)
}

func main() {
	go f()
	g()
}
>>>>
// 	可能会发生 `g` 打印出 `2` 之后再打印出 `0`。
```

双重检测锁是种避免同步开销的尝试。例如，`twoprint` 程序可能会错误地写成：

```go
var a string
var done bool

func setup() {
	a = "hello, world"
	done = true
}

func doprint() {
	if !done {
		once.Do(setup)
	}
	print(a)
}

func twoprint() {
	go doprint()
	go doprint()
}
>>>
/*
但这里并不保证在 `doprint` 中对 `done` 的写入进行监测蕴含对 `a` 的写入进行监测。这个版本可能会（错误地）打印出一个空字符串而非 `"hello, world"`。
*/
```

另一种错误的习惯就是忙于等待一个值，就像这样：

```go
var a string
var done bool

func setup() {
	a = "hello, world"
	done = true
}

func main() {
	go setup()
	for !done {
	}
	print(a)
}
>>>
/*
和前面一样，这里不保证在 `main` 中对 `done` 的写入的监测， 蕴含对 `a` 的写入也进行监测，
因此该程序也可能会打印出一个空字符串。 更糟的是，由于在两个线程之间没有同步事件，
因此无法保证对 `done` 的写入总能被 `main` 监测到。
`main` 中的循环不保证一定能结束。
*/
```

这个主题有种微妙的变体，例如此程序：

```go
type T struct {
	msg string
}

var g *T

func setup() {
	t := new(T)
	t.msg = "hello, world"
	g = t
}

func main() {
	go setup()
	for g == nil {
	}
	print(g.msg)
}
>>>
//	即便 `main` 能够监测到 `g != nil` 并退出循环， 它也无法保证能监测到 `g.msg` 的初始化值。
```

这里所有例子的解决方案都是相同的：使用显式的同步

## 其他

[GO 语言中文文档](https://go-zh.org/doc/)

**2020 GO 开发者成长路线图参考：**
![GO语言学习路线图](/assets/golang-developer-roadmap-zh-CN.png)
