---
title: 'WHAT IS REST'
date: 2021-01-14 13:20:00 +0800
tags: 前端
subtitle: 'REST架构风格 基本知识了解'
---

# WHAT IS REST

> 本篇文章介绍了 REST 软件架构风格的基本知识并提供了相关例子<br>
> 翻译自原贴 - [WHAT IS REST](https://www.codecademy.com/articles/what-is-rest) 原文阅读难度不大，推荐看原文<br>
> 如果对 REST 有一定了解，推荐直接阅读 【 <u>Practice with REST 🏭</u> 】章节<br>
>
> @author : xjosiah
> @since : 2021.01.14

## REST - REpresentational State Transfer 

REST, or REpresentational State Transfer, is an architectural style for providing standards between computer systems on the web, making it easier for systems to communicate with each other. REST-compliant systems, often called RESTful systems, are characterized by how they are stateless and separate the concerns of client and server. We will go into what these terms mean and why they are beneficial characteristics for services on the Web.

REST 即 REpresentational State Transfer（中文译为表现层状态转换），是一种为连接在互联网上的计算机提供一个标准的传送数据格式的软件架构风格，其致力于让计算机之间的通信变得更加简捷。符合 REST 风格的系统通常被称为 RESTful 系统，该系统的特点是无状态的、客户端和服务器对数据的关注是分开的，接下来，我们会介绍这些术语的具体含义和为什么 REST 的这些特点对互联网提供的服务是很有好处的。

### Separation of Client and Server 

In the REST architectural style, the implementation of the client and the implementation of the server can be done independently without each knowing about the other. This means that the code on the client side can be changed at any time without affecting the operation of the server, and the code on the server side can be changed without affecting the operation of the client.

As long as each side knows what format of messages to send to the other, they can be kept modular and separate. Separating the user interface concerns from the data storage concerns, we improve the flexibility of the interface across platforms and improve scalability by simplifying the server components. Additionally, the separation allows each component the ability to evolve independently.

By using a REST interface, different clients hit the same REST endpoints, perform the same actions, and receive the same responses.

在 REST 这个软件架构风格中，客户端和服务器是分离的，即前端开发和后端开发是可以完全脱离开的。这意味前端页面可以随时随地进行修改而不会对后端开发造成任何影响，同理， 后端进行的任何迭代也都不会影响前端。

只要前后端明确了数据传输的格式就可以保持模块化和隔离。将前端页面关注的问题和数据存储关注的问题分开，我们通过简化服务器组件，提高了跨平台界面的可扩展性和灵活性。除此之外，隔离的特点还允许各个组件的开发可以是异步的、可独立发展的。

通过使用 REST 风格的接口，不同客户端可以连接同一个 REST 服务端口，执行一致的操作，获取相同的响应。

### Statelessness 

Systems that follow the REST paradigm are stateless, meaning that the server does not need to know anything about what state the client is in and vice versa. In this way, both the server and the client can understand any message received, even without seeing previous messages. This constraint of statelessness is enforced through the use of _resources_, rather than _commands_. Resources are the nouns of the Web - they describe any object, document, or _thing_ that you may need to store or send to other services.

Because REST systems interact through standard operations on resources, they do not rely on the implementation of interfaces.

These constraints help RESTful applications achieve reliability, quick performance, and scalability, as components that can be managed, updated, and reused without affecting the system as a whole, even during operation of the system.

Now, we’ll explore how the communication between the client and server actually happens when we are implementing a RESTful interface.

遵循 REST 风格的系统是无状态的，这意味着服务器不需要知道客户端处于什么状态，反之亦然。在这种风格中，客户端和服务器不需要关注之前的信息就可以解析接受到的数据。无状态的特性约束我们必须使用*资源*而不是*命令*。资源，即用来表示对象、文档或者那些你要存储或者发送给其他服务的东西。

REST 风格通过一些标准操作来控制资源，所以其并不依赖数据接口的实现方式。

这些约束条件帮助 REST 风格的应用能实现了可靠性、高性能和可扩展性，*（同时这些应用作为）*组件是可被管理、迭代和重复使用的，即使在系统运行的过程中*（发生任何改动）*也不会影响系统整体。

现在，我们将揭示了实现 REST 风格接口的客户端和服务器之间是如何进行通信的。

## Communication between Client and Server 

In the REST architecture, clients send requests to retrieve or modify resources, and servers send responses to these requests. Let’s take a look at the standard ways to make requests and send responses.

在 REST 架构中，客户端发送 request 请求去获取或者更新资源，服务器回送 response 响应这些请求。接下来，我们将展示发送请求和回送响应的标准方法。

### Making Requests 

REST requires that a client make a request to the server in order to retrieve or modify data on the server. A request generally consists of:

- an HTTP verb, which defines what kind of operation to perform
- a _header_, which allows the client to pass along information about the request
- a path to a resource
- an optional message body containing data

REST 风格的请求，即客户端用于获取或者更新数据而向服务器发送的请求，通常包括：

- 一个 HTTP 动作，其定义了要执行的何种操作
- 一个 首部，客户端用来传递与请求相关的信息
- 一个 请求资源的路径
- 一个 可选的带数据消息体（PUT 和 POST 中常见）

#### HTTP Verbs

There are 4 basic HTTP verbs we use in requests to interact with resources in a REST system:

- GET — retrieve a specific resource (by id) or a collection of resources
- POST — create a new resource
- PUT — update a specific resource (by id)
- DELETE — remove a specific resource by id

You can learn more about these HTTP verbs in the following Codecademy article:

- [What is CRUD?](https://www.codecademy.com/articles/what-is-crud)

以下是四种基础的 HTTP 方法，常用在 REST 系统中的与资源通信相关的请求中：

- GET - 用于获取资源（通常通过 ID 获取单个资源）或者资源的集合
- POST - 用于创建新的资源
- PUT - 用于更新资源
- DELETE - 用于删除指定 ID 的资源

与 HTTP 方法相关的更多信息可参考：[What is CRUD?](https://www.codecademy.com/articles/what-is-crud)

#### Headers and Accept parameters

In the header of the request, the client sends the type of content that it is able to receive from the server. This is called the `Accept` field, and it ensures that the server does not send data that cannot be understood or processed by the client. The options for types of content are MIME Types (or Multipurpose Internet Mail Extensions, which you can read more about in the [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types).

MIME Types, used to specify the content types in the `Accept` field, consist of a `type` and a `subtype`. They are separated by a slash (/).

For example, a text file containing HTML would be specified with the type `text/html`. If this text file contained CSS instead, it would be specified as `text/css`. A generic text file would be denoted as `text/plain`. This default value, `text/plain`, is not a catch-all, however. If a client is expecting `text/css` and receives `text/plain`, it will not be able to recognize the content.

Other types and commonly used subtypes:

- `image` — `image/png`, `image/jpeg`, `image/gif`
- `audio` — `audio/wav`, `audio/mpeg`
- `video` — `video/mp4`, `video/ogg`
- `application` — `application/json`, `application/pdf`, `application/xml`, `application/octet-stream`

For example, a client accessing a resource with `id` 23 in an `articles` resource on a server might send a GET request like this:

```
GET /articles/23
Accept: text/html, application/xhtml
```

The `Accept` header field in this case is saying that the client will accept the content in `text/html` or `application/xhtml`.

请求的首部用于客户端告知服务器其可以接受的数据类型，即`Accept`字段，这可以确保服务器不会回送客户端无法解析或者处理的数据。这写数据格式被称为 MIME 类型（Multipurpose Internet Mail Extensions, 多用途互联网邮箱扩展的标准，更多信息请参考[MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types)）

MIME 类型用于`Accept`字段中指定可接受的数据类型，由`type`和`subtype`组成，用斜线号( / )隔开

一个 HTML 类型的文本会被指定成`text/html`类型，但如果其中包含了 CSS 样式表则会被指定成`text/css`类型，一个通用的文本会被指定成`text/plain`，但这个默认类型无法适应于全部情况，如果客户端请求一个`text/css`类型的资源，但服务器回送的是`text/plain`类型的资源，客户端将无法识别。

其他常用的数据类型如下：

- `image` — `image/png`, `image/jpeg`, `image/gif`
- `audio` — `audio/wav`, `audio/mpeg`
- `video` — `video/mp4`, `video/ogg`
- `application` — `application/json`, `application/pdf`, `application/xml`, `application/octet-stream`

如果客户端要获取服务器上一个`id`为 23 的`articles`资源，会发送如下的 GET 请求：

```request
GET /articles/23
Accept: text/html, application/xhtml
```

`Accept`字段表明客户端可以接受 `text/html`和`applicaton/xhtml`类型的数据

#### Paths

Requests must contain a path to a resource that the operation should be performed on. In RESTful APIs, paths should be designed to help the client know what is going on.

Conventionally, the first part of the path should be the plural form of the resource. This keeps nested paths simple to read and easy to understand.

A path like `fashionboutique.com/customers/223/orders/12` is clear in what it points to, even if you’ve never seen this specific path before, because it is hierarchical and descriptive. We can see that we are accessing the order with `id` 12 for the customer with `id` 223.

Paths should contain the information necessary to locate a resource with the degree of specificity needed. When referring to a list or collection of resources, it is not always necessary to add an `id`. For example, a POST request to the `fashionboutique.com/customers` path would not need an extra identifier, as the server will generate an `id` for the new object.

If we are trying to access a single resource, we would need to append an `id` to the path. For example: `GET fashionboutique.com/customers/:id` — retrieves the item in the `customers` resource with the `id` specified. `DELETE fashionboutique.com/customers/:id` — deletes the item in the `customers` resource with the `id` specified.

请求必须包含要操作的资源的路径。在 REST 风格的接口中，路径被设计来帮助客户端理解请求执行了什么。

通常，路径的第一个部分应当是资源的复数形式，这保证嵌套路径依旧便于阅读和理解。

一个如 `fashionboutique.com/customers/223/orders/12`类型的路径很清晰地指明了含义，即使你从未见过这类路径，这是因为该路径是具有层次性和可描述性的。可以看出我们作为一个` id`为 223 的顾客，发起了一个`id`为 12 的订单。

路径必须包含必要的信息来指定具体的资源。当请求是资源的数组或集合时，通常不需要添加`id`。例如，一个发向 `fashionboutique.com/customers` 的 POST 请求不需要额外的标识，服务器会自动为新对象创建一个`id`。

如果我们需要获取单例类型的资源，我们必须在路径中添加`id`。例如：

- `GET fashionboutique.com/customers/:id` —— 通过指明`id`在`customers`中获取一个对应的项
- `DELETE fashionboutique.com/customers/:id ` —— 通过指明`id`在`customers`中删除一个对应的项

### Sending Responses 

#### Content Types

In cases where the server is sending a data payload to the client, the server must include a `content-type` in the header of the response. This `content-type` header field alerts the client to the type of data it is sending in the response body. These content types are MIME Types, just as they are in the `accept` field of the request header. The `content-type` that the server sends back in the response should be one of the options that the client specified in the `accept` field of the request.

For example, when a client is accessing a resource with `id` 23 in an `articles` resource with this GET Request:

```
GET /articles/23 HTTP/1.1
Accept: text/html, application/xhtml
```

The server might send back the content with the response header:

```
HTTP/1.1 200 (OK)
Content-Type: text/html
```

This would signify that the content requested is being returning in the response body with a `content-type` of `text/html`, which the client said it would be able to accept.

在服务器回送数据给客户端时，服务器也需要在 response 响应的首部中包含一个 `content-type`字段。这个字段告知客户端 response 信息体的数据类型。这个数据类型也是用 MIME 类型来表示，这和请求的`accept`字段中的使用是一致的。 在服务器回送的 response 响应中`content-type`类型应当是客户端`accept`字段指明类型的其中一种。

依旧以客户端通过一个 GET 请求获取服务器上一个`id`为 23 的`articles`资源为例：

```
GET /articles/23 HTTP/1.1
Accept: text/html, application/xhtml
```

服务器回送 response 响应的首部应当为：

```
HTTP/1.1 200 (OK)
Content-Type: text/html
```

这指明了回送给请求的 response 响应的消息体的类型是客户端可以解析的、由`content-type`字段指明的`text/html`类型。

#### Response Codes

Responses from the server contain status codes to alert the client to information about the success of the operation. As a developer, you do not need to know every status code (there are [many](http://www.restapitutorial.com/httpstatuscodes.html) of them), but you should know the most common ones and how they are used:

| Status code                 | Meaning                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 200 (OK)                    | This is the standard response for successful HTTP requests.                                                       |
| 201 (CREATED)               | This is the standard response for an HTTP request that resulted in an item being successfully created.            |
| 204 (NO CONTENT)            | This is the standard response for successful HTTP requests, where nothing is being returned in the response body. |
| 400 (BAD REQUEST)           | The request cannot be processed because of bad request syntax, excessive size, or another client error.           |
| 403 (FORBIDDEN)             | The client does not have permission to access this resource.                                                      |
| 404 (NOT FOUND)             | The resource could not be found at this time. It is possible it was deleted, or does not exist yet.               |
| 500 (INTERNAL SERVER ERROR) | The generic answer for an unexpected failure if there is no more specific information available.                  |

For each HTTP verb, there are expected status codes a server should return upon success:

- GET — return 200 (OK)
- POST — return 201 (CREATED)
- PUT — return 200 (OK)
- DELETE — return 204 (NO CONTENT) If the operation fails, return the most specific status code possible corresponding to the problem that was encountered.

服务器的响应会包含一个状态码用于标识本次请求执行的成功与否。作为开发者，你不需知道清楚每种状态码的含义（点击[many](http://www.restapitutorial.com/httpstatuscodes.html) 获取更多与状态码有关的详细信息），但你应当知道一些常用的状态码的含义以及如何使用它们:

| Status code                 | Meaning                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 200 (OK)                    | This is the standard response for successful HTTP requests.                                                       |
| 201 (CREATED)               | This is the standard response for an HTTP request that resulted in an item being successfully created.            |
| 204 (NO CONTENT)            | This is the standard response for successful HTTP requests, where nothing is being returned in the response body. |
| 400 (BAD REQUEST)           | The request cannot be processed because of bad request syntax, excessive size, or another client error.           |
| 403 (FORBIDDEN)             | The client does not have permission to access this resource.                                                      |
| 404 (NOT FOUND)             | The resource could not be found at this time. It is possible it was deleted, or does not exist yet.               |
| 500 (INTERNAL SERVER ERROR) | The generic answer for an unexpected failure if there is no more specific information available.                  |

每个 HTTP 动作都有相应的成功状态码：

- GET — return 200 (OK)
- POST — return 201 (CREATED)
- PUT — return 200 (OK)
- DELETE — return 204 (NO CONTENT) 如果执行失败，需要返回和相关操作有关的具体状态码

---

> 以下提供了两个例子：第一个是 _请求_ 和 _响应_ 的格式的展示，第二个是 _REST 风格项目_ 构建过程的介绍
>
> 推荐阅读程度： :star2::star2::star2::star2::star2:

## Examples of Requests and Responses 

Let’s say we have an application that allows you to view, create, edit, and delete customers and orders for a small clothing store hosted at `fashionboutique.com`. We could create an HTTP API that allows a client to perform these functions:

If we wanted to view all customers, the request would look like this:

```request
GET http://fashionboutique.com/customers
Accept: application/json
```

A possible response header would look like:

```response
Status Code: 200 (OK)
Content-type: application/json
```

followed by the `customers` data requested in `application/json` format.

Create a new customer by posting the data:

```json
POST http://fashionboutique.com/customers
Body:
{
  “customer”: {
    “name” = “Scylla Buss”,
    “email” = “scylla.buss@codecademy.org”
  }
}
```

The server then generates an `id` for that object and returns it back to the client, with a header like:

```response
201 (CREATED)
Content-type: application/json
```

To view a single customer we _GET_ it by specifying that customer’s id:

```request
GET http://fashionboutique.com/customers/123
Accept: application/json
```

A possible response header would look like:

```response
Status Code: 200 (OK)
Content-type: application/json
```

followed by the data for the `customer` resource with `id` 23 in `application/json` format.

We can update that customer by _PUT_ ting the new data:

```json
PUT http://fashionboutique.com/customers/123
Body:
{
  “customer”: {
    “name” = “Scylla Buss”,
    “email” = “scyllabuss1@codecademy.com”
  }
}
```

A possible response header would have `Status Code: 200 (OK)`, to notify the client that the item with `id` 123 has been modified.

We can also _DELETE_ that customer by specifying its `id`:

```
DELETE http://fashionboutique.com/customers/123
```

The response would have a header containing `Status Code: 204 (NO CONTENT)`, notifying the client that the item with `id` 123 has been deleted, and nothing in the body.

## Practice with REST 

Let’s imagine we are building a photo-collection site. We want to make an API to keep track of users, venues, and photos of those venues. This site has an `index.html` and a `style.css`. Each user has a username and a password. Each photo has a venue and an owner (i.e. the user who took the picture). Each venue has a name and street address. Can you design a REST system that would accommodate:

- storing users, photos, and venues
- accessing venues and accessing certain photos of a certain venue

Start by writing out:

- what kinds of requests we would want to make
- what responses the server should return
- what the `content-type` of each response should be

### Possible Solution - Models

```json
{
  “user”: {
    "id": <Integer>,
    “username”: <String>,
    “password”:  <String>
  }
}
{
  “photo”: {
    "id": <Integer>,
    “venue_id”: <Integer>,
    “author_id”: <Integer>
  }
}
{
  “venue”: {
    "id": <Integer>,
    “name”: <String>,
    “address”: <String>
  }
}
```

### Possible Solution - Requests/Responses

#### GET Requests

Request- `GET /index.html` Accept: `text/html` Response- 200 (OK) Content-type: `text/html`

Request- `GET /style.css` Accept: `text/css` Response- 200 (OK) Content-type: `text/css`

Request- `GET /venues` Accept:`application/json` Response- 200 (OK) Content-type: `application/json`

Request- `GET /venues/:id` Accept: `application/json` Response- 200 (OK) Content-type: `application/json`

Request- `GET /venues/:id/photos/:id` Accept: `application/json` Response- 200 (OK) Content-type: `image/png`

#### POST Requests

Request- `POST /users` Response- 201 (CREATED) Content-type: `application/json`

Request- `POST /venues` Response- 201 (CREATED) Content-type: `application/json`

Request- `POST /venues/:id/photos` Response- 201 (CREATED) Content-type: `application/json`

#### PUT Requests

Request- `PUT /users/:id` Response- 200 (OK)

Request- `PUT /venues/:id` Response- 200 (OK)

Request- `PUT /venues/:id/photos/:id` Response- 200 (OK)

#### DELETE Requests

Request- `DELETE /venues/:id` Response- 204 (NO CONTENT)

Request- `DELETE /venues/:id/photos/:id` Response- 204 (NO CONTENT)
