---
title: '《深入浅出MySQL》知识整理'
date: 2021-03-11 12:30:00 +0800
tags: 后端
subtitle: '对MySQL的常用知识的理解'
---

# 《深入浅出 MySQL》知识整理

> 对《深入浅出 MySQL》中理解不深入章节的知识笔记整理

## 窗口函数

窗口函数的语法定义:

```mysql
SELECT * FROM (
  SELECT 窗口函数() OVER([PARTITION BY|ORDER BY]column_name |[FRAME 子句]) AS column_name,
  column_name1,column_name2.....FROM table_name
	)table_name [WHERE];
```

​ 窗口函数可以借助聚合函数的概念来理解，聚合函数是把多个行聚合到同一行，而窗口函数是把多个行聚合到相同的多个行里，窗口的意思就是要在表中根据某一个条件划分出某一个区域，如果区域的大小不变则为静态窗口，大小浮动则为滑动窗口。

​ 划分窗口使用的就是使用`PARTITION BY`语句把某一列进行窗口划分，窗口函数就被用来对这些窗口进行某些的操作，`ORDER BY`语句就是定义排序规则，`FRAME`语句则被用来创建滑动窗口。

- **MySQL 中的窗口函数：**

  | 函数                | 功能                                   |
  | ------------------- | -------------------------------------- |
  | **ROW_NUMBER()**    | **分区中当前的行号**                   |
  | **RANK()**          | **当前行在分区中的排名，含序号间隙**   |
  | **DENSE_RANK()**    | **当前行在分区中的排名，不含序号间隙** |
  | PERCENT_RANK()      | 百分比等级值                           |
  | **CUME_DIST()**     | **累计百分比(RANK 值/分组总数)**       |
  | **_FIRST_VALUE()_** | **_当前窗口中的第一行参数的值_**       |
  | **_LAST_VALUE()_**  | **_当前窗口中的最尾行参数的值_**       |
  | LAG()               | 分区中指定好落后于当前行的参数值       |
  | LEAD()              | 分区中领先当前行的参数值               |
  | NTH_VALUE()         | 从第 N 行窗口框架的参数值              |
  | NTILE()             | 分区中当前行的桶号(按某种规则等分小组) |

- `PARTITION BY`**划分小组的理解**：

  ```mysql
  #	所使用的数据展示
  mysql> select * from order_tab;
  +----------+---------+--------+---------------------+
  | order_id | user_no | amount | create_date         |
  +----------+---------+--------+---------------------+
  |        1 |       1 |    100 | 2021-03-01 00:00:00 |
  |        2 |       1 |    300 | 2021-03-02 00:00:00 |
  |        3 |       1 |    500 | 2021-03-02 00:00:00 |
  |        4 |       1 |    800 | 2021-03-03 00:00:00 |
  |        5 |       1 |    900 | 2021-03-04 00:00:00 |
  |        6 |       2 |    500 | 2021-03-05 00:00:00 |
  |        7 |       2 |    600 | 2021-03-06 00:00:00 |
  |        8 |       2 |    300 | 2021-03-07 00:00:00 |
  |        9 |       2 |    800 | 2021-03-08 00:00:00 |
  |       10 |       2 |    800 | 2021-03-09 00:00:00 |
  +----------+---------+--------+---------------------+
  10 rows in set (0.01 sec)
  ```

  我们先从`FIRST_VALUE()`和`LAST_VALUE()`创建一个滑动窗口入手，先书写一个这样的语句：

  ```mysql
  #	这条语句的意思是按user_no划分窗口（这里有两个小组即user_no=1 | user_no=2）
  # 然后窗口滑动增大，并找出当前窗口中第一个值和最后一个值，窗口按order_id排序
  mysql> select *
      -> from (
      ->          select order_id,
      ->                 user_no,
      ->                 amount,
      ->                 first_value(amount) over (w) as first_amount,
      ->                 last_value(amount) over (w)  as last_amount
      ->          from order_tab WINDOW w as (partition by user_no order by order_id)
      ->      ) t;
  +----------+---------+--------+--------------+-------------+
  | order_id | user_no | amount | first_amount | last_amount |
  +----------+---------+--------+--------------+-------------+
  |        1 |       1 |    100 |          100 |         100 |
  |        2 |       1 |    300 |          100 |         300 |
  |        3 |       1 |    500 |          100 |         500 |
  |        4 |       1 |    800 |          100 |         800 |
  |        5 |       1 |    900 |          100 |         900 |
  |        6 |       2 |    500 |          500 |         500 |
  |        7 |       2 |    600 |          500 |         600 |
  |        8 |       2 |    300 |          500 |         300 |
  |        9 |       2 |    800 |          500 |         800 |
  |       10 |       2 |    800 |          500 |         800 |
  +----------+---------+--------+--------------+-------------+
  10 rows in set (0.01 sec)
  ```

  静态窗口同理，假设我们要查看排名的话可以使用`RANK()`系列的函数，如果使用了`partition by user_no`就是按用户分组查看排名，按哪一列进行排序则要看`order by `语句。此时该函数，随着记录的不同，窗口大小都是不变的（即查看排名时窗口大小都是两个用户分组的大小），不像上段代码中滑动增长，因此就被称为是静态窗口。

  _<u>（这段代码就靠自己书写啦！PS：找好相对应的函数，如果用`DENSE_RANK(amount)`就是`amount`排名）</u>_

- **FRAME 子句：基于行和基于范围：**

  > 以下摘抄于《深入浅出 MySQL - 5.6 窗口函数》FRAME 子句部分

  1. 基于行：通常使用 `BETWEEN frame_start AND frame_end`来表示行范围，以下关键字可以支持`frame_start`和`frame_end`，这样可以用来确定不同的动态行记录：

     ```mysql
     `CURRNT ROW`					# 边界是当前行，一般和其他范围关键字一起使用
     `UNBOUNDED PRECEDING` # 边界是分区的第一行
     `UNBOUNDED FOLLOWING`	# 边界是分区的最后一行
     `expr PRECEDING`			# 边界是当前行减去expr的值
     `expr FOLLOWING`			# 边界是当前行加上expr的值

     # 以下为一些用法
     # 窗口范围是当前行、前一行、后一行一共3行记录
     rows BETWEEN 1 PRECEDING AND 1 FOLLOWING

     #	窗口范围是当前行到分区中的最后一行
     rows UNBOUNDED FOLLOWING

     # 窗口范围是当前分区中所有行
     rows BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
     ```

  2. 基于范围：有些范围不可以直接使用行数来表示，如果窗口范围是一周前的订单开始到当前行，这需要使用范围来表示窗口:`INTERVAL 7 DAY PRECEDING`，时间就是一个可以经常被使用的应用场景

  ```mysql
  #  FRAME子句使用展示：把当前行与上下行的amount进行加和并输出
  mysql> select *
      -> from (
      ->          select order_id,
      ->                 user_no,
      ->                 amount,
      ->                 sum(amount) over w as summary
      ->          from order_tab
      ->              WINDOW w as (partition by user_no
      ->                  order by order_id
      ->                  rows between 1 preceding and 1 following)
      ->      ) t;
  +----------+---------+--------+---------+
  | order_id | user_no | amount | summary |
  +----------+---------+--------+---------+
  |        1 |       1 |    100 |     400 |
  |        2 |       1 |    300 |     900 |
  |        3 |       1 |    500 |    1600 |
  |        4 |       1 |    800 |    2200 |
  |        5 |       1 |    900 |    1700 |
  |        6 |       2 |    500 |    1100 |
  |        7 |       2 |    600 |    1400 |
  |        8 |       2 |    300 |    1700 |
  |        9 |       2 |    800 |    1900 |
  |       10 |       2 |    800 |    1600 |
  +----------+---------+--------+---------+
  10 rows in set (0.09 sec)
  ```

- **聚合函数：**由上所示，聚合函数也可以作为窗口函数来使用，如求累计、平均、最大、最小、总数都是被作为窗口函数来使用的。

#### 建表使用的 MySQL 语句

```mysql
create table order_tab(order_id int not null PRIMARY KEY ,user_no int not null ,amount int,create_date datetime);

INSERT INTO test1.order_tab (order_id, user_no, amount, create_date) VALUES (1, 1, 100, '2021-03-01 00:00:00')
INSERT INTO test1.order_tab (order_id, user_no, amount, create_date) VALUES (2, 1, 300, '2021-03-02 00:00:00')
INSERT INTO test1.order_tab (order_id, user_no, amount, create_date) VALUES (3, 1, 500, '2021-03-02 00:00:00')
INSERT INTO test1.order_tab (order_id, user_no, amount, create_date) VALUES (4, 1, 800, '2021-03-03 00:00:00')
INSERT INTO test1.order_tab (order_id, user_no, amount, create_date) VALUES (5, 1, 900, '2021-03-04 00:00:00')
INSERT INTO test1.order_tab (order_id, user_no, amount, create_date) VALUES (6, 2, 500, '2021-03-05 00:00:00')
INSERT INTO test1.order_tab (order_id, user_no, amount, create_date) VALUES (7, 2, 600, '2021-03-06 00:00:00')
INSERT INTO test1.order_tab (order_id, user_no, amount, create_date) VALUES (8, 2, 300, '2021-03-07 00:00:00')
INSERT INTO test1.order_tab (order_id, user_no, amount, create_date) VALUES (9, 2, 800, '2021-03-08 00:00:00')
INSERT INTO test1.order_tab (order_id, user_no, amount, create_date) VALUES (10, 2, 800, '2021-03-09 00:00:00')
```

## 索引：

索引，主要被用来快速查找表中的某些符合特定规则的行（数据），如果不使用索引，则需要逐行查找数据导致效率低下。不过索引的存在需要占用一些磁盘空间，而且在更新、删除、插入一些数据的时会使得效率降低，因此不是所有的表都需要索引，在存放大量数据的表中使用索引可以提高工作效率，有时候在小型表中使用主键就完全足够了。索引也不是越多越好，太多的索引避免不了会影响操作数据的效率。

**索引设计的原则**：

1. 尽量在条件列上设置索引，即用在`WHERE`中
2. 尽量使用选择度高的列，尽量使用唯一索引，如性别和日期两种类型数据，选择日期做索引要更优
   - <u>_索引的选择度是指不重复的索引值（基数）和数据表中的记录总数的比值。选择度高的索引可以在查找时过滤掉更多的行。唯一索引的选择性是 1，这是最好的索引选择性，性能也是最好的。_</u>
3. 使用短索引，短索引涉及的磁盘 IO 较少，在高速缓存中能存放更多的索引
4. 聚合索引时要遵循最左索前缀的原则，可以利用索引中最左边的列来匹配行
5. 尽量不要使用字符类型作为索引，这样会大大增加磁盘操作
6. 最好将要创建索引的列的默认值设为非 NULL

在设计索引的时候，可以利用 SQL 日志来分析各个表被操作的情况，从这些操作中我们优先给那些执行效率最高的 SQL 创建索引。为了减少索引的数量，我们可以采用合并索引的方法。

#### HASH 索引 和 Btree 索引

> 参考资料：[MySQL 索引总结](https://zhuanlan.zhihu.com/p/29118331)

 **HASH 索引**：

MySQL 中只有 Memory/NDB 引擎完全支持 Hash 索引，Hash 索引是计算索引列的 hash 值然后放到索引表中，而表项就是指向对应行（数据）的指针。

如`SELECT a.name FROM table a where a.id = XXX `这条语句中，会将 id 进行求 hash 值然后找到索引表中对应的 hash 值，再从对应的表项中取出行。

最特殊的是，==该引擎支持不唯一的 hash 索引==，如果多个索引拥有同样的 hash 值，索引会将表项中的指针链接成链表。

> **Hash 索引有以下一些限制：**
>
> - 由于索引仅包含 hash code 和记录指针，所以，MySQL 不能通过使用索引避免读取记录，即每次使用哈希索引查询到记录指针后都要回读元祖查取数据。
> - 不能使用 hash 索引排序。
> - Hash 索引不支持键的部分匹配，因为是通过整个索引值来计算 hash 值的。
> - **Hash 索引只支持等值比较，例如使用=，IN( )和<=>。对于 WHERE price>100 并不能加速查询。**
> - 访问 Hash 索引的速度非常快，除非有很多哈希冲突（不同的索引列值却有相同的哈希值）。当出现哈希冲突的时候，存储引擎必须遍历链表中所有的行指针，逐行进行比较，直到找到所有符合条件的行。
> - 如果哈希冲突很多的话，一些索引维护操作的代价也会很高。当从表中删除一行时，存储引擎要遍历对应哈希值的链表中的每一行，找到并删除对应行的引用，冲突越多，代价越大。

 **Btree 索引**：

B-tree 是一种适合范围查询的索引类型，适用于`> | < | <= | >= | BETWEEN | != | <>  | LIKE ` 这是因为 B-tree 索引是按顺序排序的，即每个节点都含有指向叶子节点的指针，所以在范围操作的时候能发挥很大作用。同时，该索引也是可以用在`ORDER BY`索引排序的。

B-tree 索引是基于内存中的缓存池的，InnoDB 还会在最经常使用的 B-tree 索引上自动创建一个 HASH 索引来提高搜索的效率。

PS: B-tree = Balanced-tree 而 != Binary-tree 即是平衡树而不是二叉树

#### 不可见索引

这个索引主要是用于删除索引前的准备工作，如将一个索引从`VISIBLE -> INVISIBLE`后，可以观察因此造成的影响（MySQL 不会使用不可见索引），如果分析的结果中，索引不可见后影响不大，则表明不可见索引是可被删除的，这是因为随着表中数据量的增大，对表上的索引进行调整应该更谨慎。

1. 可以在创建表时直接创建不可见索引

```mysql
CREATE TABLE t1{
	i int not null PRIMARY KEY AUTO_INCREMENT
	j int
	k int
	INDEX i_idx (i) INVISIBLE
}
```

2. 可以单独添加不可见索引，或者==修改索引为不可见==

```mysql
CREATE INDEX j_idx ON t1(j) INVISIBLE;
ALTER TABLE t1 ADD INDEX k_idx (k) INVISIBLE;

ALTER TABLE t1 ALTER INDEX i_idx VISIBLE;
ALTER TABLE t1 ALTER INDEX i_idx INVISIBLE;
```

### 索引问题 之 MySQL 如何使用索引 

**MySQL 中能够使用的索引的经典场景：**

1. 匹配全值（Match all the full value）一次查询对索引中所有列都有等值匹配
2. 匹配值的范围查询（Match a range of values）对索引的值能够进行范围查找，且要根据索引回表插值
   - ==MySQL5.6 引入了 ICP(Index Condition Pushdown)==即将过滤操作下放到了存储引擎，进一步优化了查询，具体含义是在找到索引回表查询的时候，会在索引上进行过滤，最终得到索引过滤后的指针回表取数据
3. 匹配最左前缀，仅用索引最左边列进行查找，是 B-tree 索引使用的首要原则
4. 仅对索引进行查询，要查找的列被包含在索引中
5. 匹配类前缀，仅匹配索引中的第一列，且只包含所以第一列开头的一部分进行查找
6. 索引部分精确匹配而其余的范围匹配
7. 列名是索引，使用`column_name is null`也会使用到索引

**存在索引但不能使用索引的经典场景：**

1.  使用%开头的 LILKE 查询不能使用 B-tree 索引。这是由 B-tree 本身的特性决定的，一般可以使用全文索引(Fulltext)来解决，或者先利用 B-tree 索引的二级索引找到满足`LIKE %X`的数据，再在这些索引指针去回表检索数据，这样能避开全表扫描:

```mysql
SELECT * FROM (
	SELECT id FROM table_1 WHERE name LIKE "%XX%"
)a, table_1 b where a.id = b.id
```

PS:(<u>_全文索引是 MyISAM 的一个特殊索引类型，它查找的是文本中的关键词，主要用于全文检索_</u>)

2. 数据类型出现隐式转换的时候不会使用索引。一定要在`WHERE`中把字符常量的值用引号包括，否则不使用索引，因为 MySQL 默认把输入的常量值进行转换后才进行检索

3. 复合索引不符合最左前缀的情况

4. MySQL 预估索引检索时间比全表扫描更慢时不使用索引

5. 在 or 分割开的条件，如果 or 前的条件中有索引，但后面的没有索引，则只会走全表扫描

`show status like 'Hanlder_read%'`查看索引的使用情况，其中`Handler_read_rnd_next`的值越高，说明表索引的设置越不理想

## 【暂停】开发常用数据库对象（大坑！！！ ）：

> 这真的是一个大坑！！繁琐、难用是我对这一章节的印象，看十几分钟后脑子里的想法都是来颗陨石吧！ 具体内容实在无法静心读完并找到其中的精华（能力不过关）日后如果有业务相关再进行填坑吧！弃坑辽

#### 视图

视图，是屏蔽了对应表的结构影响的一种过滤好的复合条件的结果集，源表增加列对视图没有影响，而原表修改列名可以通过修改视图来解决，可以理解为把某一次查询出来的数据存到一个实际不存在的表中（`SHOW TABLE STATUS`命令会同时显示表和视图）。

视图是可以更新的，除了在以下情况：

1. 包含以下关键字的 SQL 语句: `聚合函数、DISTINCT、GROUP BY、HAVING、UNION或UNION ALL`
2. 常量视图 | `SELECT`中包含子查询 | `JOIN` | `FROM`一个不能更新的视图
3. `WHERE`子句的子查询引用了 FROM 子句中的表

`WITH [CASCADED | LOCAL] CHECK OPTION`命令决定了是否允许更新数据使得记录不再满足视图的条件，`LOCAL`只要满足本视图就可以更新，`CASCADED`必须满足所有针对该视图的视图的条件才可以更新，默认为`CASCADED`

#### 存储过程、存储函数和触发器

存储过程和函数都是一段 SQL 语句的集合，存储函数可以被各类语句重用，而存储过程主要用于解决某一个具体的问题，简单而言就是用 SQL 编程。

触发器即满足特定条件时执行对应的语句集合，只能建立在永久表上

## MySQL 分区：

分区主要用于管理大表，按照一定的范围、特定值列表或者 HASH 函数值来把数据进行区域划分，大部分存储引擎（MyISAM | InnoDB | Memory 等）都支持分区，除了 MERGE | CSV | FEDERATED 这三类不支持，且在同一个表上不能对多个分区使用多个引擎。

**分区类型**：

1. RANGE 范围分区：基于一个给定的连续区间的范围来分区
2. LIST 分区：基于枚举的值来进行分区
3. COLUMNS 分区：分区键可以是多列、非整数
   1. RANGE COLUMNS 分区
   2. LIST COLUMNS 分区
4. HASH 分区：基于给定的分区个数，把数据取模进行分区
5. KEY 分区：和 HASH 分区类似但基于 MySQL 的哈希函数进行分区
6. 子分区：在主分区下又一次分区

LIST | RANGE | HASH 分区 都需要分区键为 INT 类型，如果需要非整数可用 COLUMNS 分区，不能使用除主键（或唯一键）外的列进行分区。列名、别名、分区名都是不区分大小写的

#### RANGE 分区

特点：数据存储是连续的，其利用取值范围把区间连续且不重叠的数据进行分区

```mysql
CREATE TABLE emp(
    id INT NOT NULL AUTO_INCREMENT,
    store_id INT NOT NULL
)PARTITION BY RANGE (store_id)(
    PARTITION p0 VALUES LESS THAN (10),
    PARTITION p1 VALUES LESS THAN (20),
    PARTITION p2 VALUES LESS THAN (30),
    PARTITION p3 VALUES LESS THAN MAXVALUE # 用于处理store_id不小于30的的数据
    )
```

如果没有`VALUES LESS THAN MAXVALUE`则但 store_id 不小于 30 的数据插入时会提醒失败，使用`RANGE COLUMNS`可以支持除整数外其他的一些数据类型

#### LIST 分区

特点：数据必须符合指定的枚举值，不存在像 RANGE 类似`switch语句`处理 default 情况的语句

```mysql
CREATE TABLE emp
(
    id        INT  NOT NULL,
    category INT
) PARTITION BY LIST (category)(
    PARTITION p0 VALUES IN (1,2,3,4,5),
    PARTITION p1 VALUES IN (6,7,8,9)
    );
```

同理可以使用 LIST COLUMNS

#### COLUMNS 分区

特点：支持的数据类型有整数、日期时间、字符串三大类型，其他数值 `Decimal` 和 `Float` 不支持，且不支持`text`| `blob`做分区键，且支持多列分区，同时如果使用了多列分区键，则会按从左到右的原则进行多列比较，和`RANGE`单字段分组的原理一样。

#### HASH 分区

特点：有常规分区和线性分区两种方法。

```mysql
CREATE TABLE emp
(
    id        INT  NOT NULL AUTO_INCREMENT,
    store_id  INT  NOT NULL
) PARTITION BY LINEAR HASH ( store_id ) PARTITIONS 4;

# 常规与线性的选择只在一个LINEAR关键字上的区别
```

**常规分区：**`PARTITION BY HASH(expr) PARTITIONS num`中 expr 表达式可以是一个返回非常数也非随机数的整数的任何函数（表达式），如最常见的取模运算，可以把数据均匀散列，又不会因为计算太复杂而产生性能问题（MySQL 本身不推荐使用太复杂的表达式）但其缺点也很明显，在对新增 | 减少分区时需要把数据进行重新散列会产生性能问题，不能灵活变动。

**线性分区：**使用一个线性的 2 的幂的运算法则，当线性 HASH 分区的个数是 2 的 N 次幂时，线性 HASH 分区的结果和常规分区的结果是一样的，但当分区进行维护时，MySQL 的处理可以更加快速，但数据的分布可能不太均匀。

#### KEY 分区

特点：支持除`BLOB`和`Text`外的其他类型数据作分区键。`PATITION BY KEY(expr)`中 expr 是字段列表，其只能使用 MySQL 自带的 HASH 函数来进行计算，分区键必须是唯一键且非空，默认选择的是主键。

```mysql
CREATE TABLE emp
(
    id        INT  NOT NULL AUTO_INCREMENT PRIMARY KEY ,
    store_id  INT  NOT NULL
) PARTITION BY KEY() PARTITIONS 4;
```

#### 子分区

特点：分区下的分区，又称复合分区，可以用 `RANGE | LIST | KEY | HASH ` 每个分区必须具有相同数量的子分区且必须显示指定子分区，子分区的名称在整个表中都是唯一的

```mysql
# 数量相同子分区
CREATE TABLE emp
(
    id        INT  NOT NULL AUTO_INCREMENT,
    store_id  INT  NOT NULL,
    separated DATE NOT NULL DEFAULT '1999-11-11'
) PARTITION BY RANGE (store_id)
    SUBPARTITION BY HASH ( separated )
    SUBPARTITIONS 2(
    PARTITION p0 VALUES LESS THAN (20),
    PARTITION p3 VALUES LESS THAN MAXVALUE
    );

# 子分区名称唯一
CREATE TABLE emp
(
    id       INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    store_id INT NOT NULL
) PARTITION BY KEY ()(
    PARTITION p0 (
        SUBPARTITION s0,
        SUBPARTITION s1),
    PARTITION p1(
        SUBPARTITION s2,
        SUBPARTITION s3
        )
    );
```

> **MySQL 分区处理 null 值的方式**：不禁止使用，会把 null 当成最小值或者零值进行处理（RANGE 当做最小值、LIST 中必须显示出现、HASH 和 KEY 当做 0 值处理）。这样会容易造成语义上的误判，因此最好应当设置字段非空和默认值来避免 null 值的出现。

### 分区管理 

#### RANGE | LIST 分区管理

可以实现增加、删除、拆分、合并操作：

1. 删除操作:`ALTER TABLE DROP PARTITION`语句可以用于删除，删除后无法再写入包含了已删除分区的值的数据了（LIST 中无法添加被删除的枚举值）
2. 增加操作:`ALTER TABLE ADD PARTITION`添加语句时，只能添加到分区列表的最大一端（LIST 增加的分区中不能含有已添加的枚举值）
3. 拆分合并:`ALTER TABLE REORGANIZE PARITION INTO`重定义分区，在合并的时候只能合并相邻的分区，LIST 也不能跳过分区进行重新定义。

#### HASH | KEY 分区管理

通过合并来减少分区、但可以增加分区

1. `ALTER TABLE COALESCE PARTITION` 合并分组
2. `ALTER TABLE ADD PARTITION` 增加分组

#### 交换分区

`ALTER TABLE pt EXCHANGE PARTITION p WHERE TABLE nt` 用于交换分区，要交换分区必须先将某个分区（子分区）的数据和普通表的数据进行交换，如命令中就是分区表 pt 的 p 分区和普通表 nt 进行交换。

交换分区应当满足下列条件：

- 表 nt 不能是分区表和临时表，如果需要从分区表到分区表需要使用一个中间普通表协助
- 表 pt 和表 nt 在结构上应当完全一致，包括索引名和索引列
- 表 nt 上不能有外键和相关依赖
- nt 表原有的数据应当在分区 p 定义的范围之内
