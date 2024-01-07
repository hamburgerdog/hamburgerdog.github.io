---
title: 'Java Stream API'
date: 2021-03-30 23:50:00 +0800
tags: 后端
subtitle: 'JavaStream常用小技巧的积累'
---

# Java-StreamAPI 的奇技淫巧

> :memo: 主要记录在编程中用 Steam 解决问题的一些好方法！

## 先从神奇数字`0x61c88647`开始到`Collectors`

**如何使用 Collectors 从 Stream 中找出重复的数据**

​ `0x61c88647`是`ThreadLocal`中用于 hash 散列的一个魔数，这是一个黄金分割数（斐波那契数列有关），主要作用是可以在 2 的幂次方大小的数组中让元素能分布均匀，`ThreadLocal`的源代码就不深究了，我们可以用一段代码来模拟如何使用该魔数进行散列：

```java
private static final int HASH_INCREMENT = 0x61c88647;

/**
 *	使用的方法为：
 *	先较前一个元素累加一个魔数 HASH_INCREMENT 得到 hash_code
 * 	然后用将 hash_code & (capacity - 1) 即可得到存放到数组中的位置
 */
public static void main(String[] args) {
  int hash_code;	//	当前的生成的哈希值
  int cap = 16;		//	存放的数组的容量
  int index;			//	散列到数组中的下标
  ArrayList<Integer> indexList = new ArrayList<Integer>();	//	埋个伏笔
  for (int i = 0; i < cap; i++) {
    hash_code = i * HASH_INCREMENT + HASH_INCREMENT;
    index = hash_code & (cap-1);
    System.out.println(index);
    indexList.add(index);
  }
}

/*
output:
7 14 5 12 3 10 1 8 15 6 13 4 11 2 9 0
*/
```

​ 这个神奇的魔数和 Stream 类又有什么关系呢？设想一下，当我们的 capacity 变得足够大时，我们想要查看该段模拟代码的实际散列情况要怎么操作呢？如何查看在散列时产生了在哪个下标产生了多少次 hash 冲突呢？此时，StreamAPI 就可以发挥强大作用了，这种情况刚好体现了 Stream 流的使用思想：“只关心数据流入和流出”。接下来，上解法：

```java
//	还记得上段代码中埋的那个伏笔吗！我们就是要利用它来进行酷炫的流操作

public static void main(String[] args) {
  ArrayList<Integer> indexList;	//	假设已有数据

  //	上盘小菜：产生了多少次冲突其实就是indexList中有多少重复的元素,
  //					那么我们直接过滤掉重复的元素就可以轻易得到冲突的数量了
	int clash = indexList.size() - indexList.stream().distinct().count();

  //	那么如何获取到在哪个下标，产生了多少次hash冲突呢？Collectors在向你招手

  /*
  	思路：在流中过滤出重复的下标，使用Map来存放对应的冲突次数
  				1.	将流按重复的数量进行分类，key = ID,	value = 重复次数（即冲突次数）
          2.	流收集成Map，然后从Map中取数据输出即可
         Function.identity() ---> 类似于 t -> t ，即返回一个和输入相同的值做key
         Collectors.counting() ---> 作用如其名，统计collect中的数量

         输出步骤不进行赘述
  */
  Map<Integer, Long> collect = indexList.stream()
    .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
  collect.entrySet().stream().filter(e->e.getValue()>1).forEach(System.out::println);
}
```

​ 当然这个例子并没有什么具体的意义，当数组大小不是 2 的幂次方时会产生很大的冲突，这里只做演示说明用。

### 与`groupingBy()`相似的`partitioningBy()`

​ `partitioningBy()`是一个特殊的`groupingBy()`，其也是返回一个 Map，但 key 被定义成 boolean 类型，而 value 被分成两类，即满足条件和不满足条件的。

```java
/**
 * partitioningBy测试用例
 *
 * @author xjosiah
 * @since 2021/3/10
 */
public class MyPartitioningBy {
    public static void main(String[] args) {
        Map<Boolean, List<String>> collect =
          List.of("abc", "abcd", "abcde", "abcdef", "abcdefg")
                .stream().collect(Collectors.partitioningBy(s -> s.length() > 4));
        collect.get(true).stream().forEach(System.out::println);
    }
}

/*
output:
		abcde		abcdef	abcdefg
*/
```

### 关于函数式编程接口中的 Function

​ 该是一个函数式编程的接口，主要有三种方法：`andThen()`、`compose()`、`identity()`；最后使用`apply()`来应用方法，关于用法直接上代码解释最清楚：

```java
/**
 * Function类的测试用例
 *
 * @author xjosiah
 * @since 2021/3/10
 */
public class MyFunction {
  	private static final Function<String,String> f = (s)-> "f("+s+")";
    private static final Function<String,String> g = (s)-> "g("+s+")";

    public static void main(String[] args) {
        //  先 f(a) 后 g(f(a))
        System.out.println(f.andThen(g).apply("a"));
        //  先 g(a) 后 f(g(a))
        System.out.println(f.compose(g).apply("b"));
    }
}

/*	output:
 *		g(f(a))
 *		f(g(a))
*/
```

## 无情的 NPE 杀手-Optional

​ 个人觉得这是一个了解 Stream 最好的类，因为它的存在就是为了屏蔽流操作的中间过程中会遇到的异常(NPE)，即当我们使用 Steam 时只需要关心流输出的最终结果（重复的第二遍）。先展示一个情形：有一个学校，其中学校中有各个年级，年级中又有各个班级，班级中有小组，小组中有学生，而此时我们要让一个学生去校门口拿爸爸送的旺仔牛奶 🥛，那此时我们应该怎么找到这个学生，让这个学生去喝牛奶呢？

```java
//	给出这样一段代码
mySchool.getGrade(6),getClazz(6).getGroup(6).getStudent("小明");
```

​ 但实际上，我们并不知道在查找六年级六班六组的小明同学这个环节中，那个方法会出错，毕竟“爸爸”并不总是靠谱，因此为了避免出现 NPE（空指针异常），我们需要逐次进行 null 检查......于是代码会渐渐变成下列这个样子：
![图片来源https://www.ruoduan.cn/](https://www.ruoduan.cn/static/e24bd25cfaa426840d8c5945def87881/eea4a/callbackhell.jpg)

​ 此时换成用 Optional 来操作就会优雅很多，因为我们不再需要关心中间操作（重复的第三遍）：

```java
//	为了方便演示，默认每个类中只有一个对象
public static void main(String[] args) {
  Grade grade = new Grade()
  Optional.of(grade).map(Grade::getClazz)
  									.map(Clazz::getStudent)
    								.map(Student::getName)
                    .ifPresentOrElse(s -> System.out.println(s),
                                     ()->System.out.println("找不到小明"));
}
```

​ 但实际上在很多时候我们不是总是需要 Optional 来帮助我们进行操作，切记简单至上，能用 null 简单解决的事情就不用 Optional，个人建议我们最好是在以下几种情况中再选择 Optional：

1. 如上所展示，需要多层调用且中间操作会对结果产生一定影响的时候使用
2. 在返回的数据，如果出错需要默认错误信息的时候使用（Optional 也可以抛出异常）
3. 在使用流操作的时候推荐使用
4. 需要比 != null 更清晰的语义或为了最大程度消灭 NPE 的时候使用
5. .......

​ 当然，第四点并不代表着你可以把 Optional 这样来用：

```java
Optional<Grade> optionalGrade = Optional.of(grade);
  if (optionalGrade.isPresent()){
      Optional<Clazz> optionalClazz =
          Optional.ofNullable(optionalGrade.get().getClazz());
        if (!optionalClazz.isEmpty()){
          Optional<Student> studentOptional =
            Optional.ofNullable(optionalClazz.get().getStudent());
          ....
    }
}
```

​ 如果你真的要这样用，那我只能说：“人生有梦，各自精彩”。

## `SplittableRandom`一个高质量的随机数生成器

> 根据「Java_8_API」的介绍：
>
> `public final class SplittableRandom` >`extends Object` >**适用于（在其他上下文中）使用可能产生子任务的孤立并行计算的均匀伪随机值的生成器。**
>
> 类`SplittableRandom`支持方法用于生产类型的伪随机数`int`、 `long`和`double`具有类似用途作为类[`Random`](https://www.matools.com/file/manual/jdk_api_1.8_google/java/util/Random.html)但在以下方面不同：
>
> - 系列生成值通过了 DieHarder 套件测试随机数发生器的独立性和均匀性。
> - 方法[`split()`](https://www.matools.com/file/manual/jdk_api_1.8_google/java/util/SplittableRandom.html#split--)构造并返回**与当前实例共享不可变状态的新 SplitableRandom 实例**。 然而，以非常高的概率，由两个对象共同生成的值具有与使用单个`SplittableRandom`对象的单个线程生成相同数量的值相同的统计特性。==对并行操作的一种支持==
> - SplittableRandom 的实例*不是*线程安全的。 它们被设计为跨线程分割，不共享。
>   例如， [`fork/join-style`](https://www.matools.com/file/manual/jdk_api_1.8_google/java/util/concurrent/ForkJoinTask.html)计算使用随机数可能包括以下形式的建设：
>   `new Subtask(aSplittableRandom.split()).fork()` 。
> - 该类提供了用于**生成随机流的附加方法**，在`stream.parallel()`模式（并行模式）下使用上述技术。
>
> SplittableRandom 的`SplittableRandom`不是加密安全的。 考虑在安全敏感的应用程序中使用`SecureRandom`。
>
> 此外，默认构造的实例不使用加密随机种子，除非`java.util.secureRandomSeed`设置为`true` 。
>
> _「PS : `Stream.parallel()`采用的也是`join|fork`框架的设计模式」_

### 生成随机数流的操作

先上一个简单的随机整数案例，假如班级有 40 个人，需要选十个老倒霉蛋去参加比赛，我们要怎么做？

```java
public static void main(String[] args) {
  			//	快速生成数组的秘籍！
  			//  int[] ints = IntStream.range(1, 40).toArray();
  			//  System.out.println(Arrays.toString(ints));

  			//	先生成高质量随机生成器（以后简称高机器吧。。。。）
        SplittableRandom splittableRandom = new SplittableRandom();
  			//	直接梭哈！我要一个随机的intStream，里面不要有负数，也不要有重复，而且只要10个
  			//	把这十个数和40求模然后+1即可得到随机分布在[1,40]的数了
        System.out.println(Arrays.toString(splittableRandom.ints().parallel()
                .filter(i -> i > 0).distinct().limit(10)
                .map(i -> (i % 40) + 1).toArray()));
    }
```

除此之外，这个随机生成器还可以生成随机的`boolean` 、`double`、`long`、等基本类型和其对应的流（布尔值除外）。其`split()`如上文的 APIdoc 所讲，主要是用来满足并行`join\fork`任务的。

而`join | fork`框架如《Java 并发编程的艺术》所介绍：“**其是一个用于并发执行任务的框架，是一个把「大任务分割成若干小任务」最终汇总每个小任务结果后得到大任务结果的框架**”，简单理解即这个框架处理并发的方式就是需要实现一个`compute`方法，在该方法中继续分割任务并使用`fork()`执行任务，用`join()`等待任务完成，直到任务足够小则不进行分割，而此处的随机生成器可以被使用。

关于`IntStream`等基本元素类的使用方法，我的建议是先上手一个`boxed()`然后再考虑进一步的操作，而且尽量使用容器来收集数据，使用`toArray()`等到数组真的不方便操作，除非你真的需要那数组一点点性能提升（现在的容器已经被优化得很好了）而愿意舍弃容器的便捷。

## 写在最后

> ​ 流操作是用来一个简约编码的好手段，我始终认为在**知识在需要用到时才能记忆得更深刻**。SteamAPI 的学习是很需要经验积累的（其实各种库都是这样），因此在**处理符合流特征的数据（比如说容器）时可以多考虑一下如果换成流要如何操作**。这篇小文章就是用于记录平时我在使用 Steam 时觉得好用的小知识点，有遇到好玩有用的技巧会多多加更！

突然就更不动了呢。。。近期拜读《On Java 8》的函数式编程那一章节时，被安利了一波`Scala`和`Clojure`，现在入迷了正在疯狂卷`Kotlin`​ :cry: ​ `Java`在一瞬间就变得没那么香香了（不是）

## 参考阅读

1. [java stream 中 Collectors 的用法](https://www.cnblogs.com/flydean/p/java-stream-collection.html)
2. [Java8 新特性学习-函数式编程(Stream/Function/Optional/Consumer)](https://blog.csdn.net/icarusliu/article/details/79495534)
