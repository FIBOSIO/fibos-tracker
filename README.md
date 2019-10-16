# fibos-tracker

[![NPM version](https://img.shields.io/npm/v/fibos-tracker.svg)](https://www.npmjs.org/package/fibos-tracker)
[![Build Status](https://travis-ci.org/fibosio/fibos-tracker.svg)](https://travis-ci.org/fibosio/fibos-tracker)

fibos-tracker 是一个 FIBOS 区块链数据 API 服务框架，基于 [fib-app](https://github.com/fibjs/fib-app) 框架实现.

- 提供对 FIBOS 区块数据的 emitter 监听事件
- 提供 http 服务，支持 GraphQL 调用
- 支持使用 ORM模型 定制自己的数据模型 model，自定义数据表以及自定义 hook 监听数据

使用之前您可能需要去了解一下这些内容：

- [FIBOS](https://fibos.io)
- [GraphQL](http://graphql.cn/)
- [fib-app](https://github.com/fibjs/fib-app)

**注意** 如果您使用的是 ubuntu, 请确保使用 16.04(xenial) 及其以上的版本.

## 目录

<dl>
<dt><a href="#fibos-版本支持">FIBOS 版本支持</a></dt>
<dd></dd>
<dl>
<dt><a href="#数据存储支持">数据存储支持</a></dt>
<dd></dd>
<dl>
<dt><a href="#安装-fibos-tracker">安装 fibos-tracker</a></dt>
<dd></dd>
<dl>
<dt><a href="#框架说明及-API-使用">框架说明及 API 使用</a></dt>
<dd></dd>
<dt><a href="#example-快速应用">Example-快速应用</a></dt>
<dd></dd>
<dt><a href="#高级篇-使用-orm-自定义数据">高级篇-使用 ORM 自定义数据</a></dt>
<dd></dd>
</dl>

## FIBOS 版本支持

支持: `v1.7.1.9+`

快速安装: `curl -s https://fibos.io/download/installer.sh | sh`

## 数据存储支持

- Mysql
- SQLite

## 安装 fibos-tracker

```
fibos --install fibos-tracker
```

## 框架说明及 API 使用

### fibos-tracker DB 说明

框架默认存储了 blocks 、transactions 的基础数据，如下图显示：

![数据模型](./diagram.svg)

#### blocks 表数据

| 字段                 | 类型 |	备注|
|---------------------|--------|------------|
| id     | Number   | 自增长 id   |
| block_num     | Number   | 区块高度   |
| block_time | Date    |   区块时间  |
| producer_block_id | String    |  区块 hash   |
| producer | String    |   区块 producer  |
| previous | String | 上一块 hash |
| status | String    |  可逆状态   |
| createdAt | Date    |   记录创建时间  |
| updatedAt | Date    |   记录更新时间  |

#### transactions 表数据

| 字段                 | 类型 |	备注|
|---------------------|--------|------------|
| id     | Number   | 自增长 id  |
| trx_id | String    |   交易 hash  |
| rawData | JSON    |  原始数据   |
| producer_block_id | String    |  区块 hash   |
| createdAt | Date    |   记录创建时间  |
| updatedAt | Date    |   记录更新时间  |

### fibos-tracker API 介绍

####  Tracker.Config

Config 是 Tracker 全局属性，可以使用该属性快速修改配置，如：修改存储引擎配置。

示例： 

```
const Tracker = require("fibos-tracker");

Tracker.Config.DBconnString = "mysql://root:123456@127.0.0.1/fibos_chain";
Tracker.Config.replay = true;
Tracker.Config.replayStatrBn = 1000;


```

| name                 | desc |	default|
|---------------------|--------|------------|
| DBconnString | 数据存储引擎    | 默认使用 SQLite 存储引擎    |
| replay | 是否开启 DB replay | false |
| replayStatrBn | DB replay 指定高度(需要配合replay) | 0 |

#### tracker.app

fib-app 的实例 app 对象，具体请阅读 [fib-app](https://github.com/fibjs/fib-app) 相关文档。

tracker.app 对象可支持路由访问。

示例：

```
const http = require("http");
const Tracker = require("fibos-tracker");
const tracker = new Tracker();

let httpServer = new http.Server("", 8080, {
	'/1.0/app': tracker.app
});

httpServer.run();

```

#### tracker.emitter

FIBOS emitter 插件，配合 FIBOS 的 action 插件使用。

示例：

```
const fibos = require("fibos");
const Tracker = require("fibos-tracker");
const tracker = new Tracker();

tracker.emitter();

```


#### tracker.diagram

生成数据表的关联图，如果自定义了数据表，需要先调用 tracker.use 再执行。

示例：

```
const Tracker = require("fibos-tracker");
const tracker = new Tracker();

//If exist other db modles，please exec tracker.use.

tracker.diagram();
```

#### tracker.stop

使 tracker 安全停止

示例：

```
const Tracker = require("fibos-tracker");
const tracker = new Tracker();

tracker.stop();
```

#### tracker.use

自定义 hook 监听数据，使用 ORM 模型自定义 DB 存储以及处理。

示例：

```
const fibos = require("fibos");
const Tracker = require("fibos-tracker");
const tracker = new Tracker();

tracker.use({
	defines: [(db) => {
		// ORM DB Define
	}, (db) => {
		// ORM DB Define
	}],
	hooks: {
		"eosio.token/transfer": (db, messages) => {
			// hook Tracker messages
		},
		"eosio/newaccount": (db, messages) => {
			// hook Tracker messages
		}
	}
});
```
defines 支持数组形式，满足某个 model 需要多个数据表的操作场景。

tracker.use 参数定义：

| params             | type   | desc |
|---------------------|--------|--------|
| model | Object | 自定义数据对象，包含 defines 和 hooks  |


`model` 内部参数定义：

| key             | type   | desc | params| 
|---------------------|--------|--------|--------|
| defines     | Function |使用 ORM 模型定义数据表，提供 API 访问   | `(db) => {}`参数 db 是 ORM 对象，可用于操作数据层 | 
| hooks | Function | 支持过滤 action 数据的 hook function     | `(db, messages) => {}` 参数 db 是 ORM 对象，参数 messages 是 action 原始数据集合 |

hooks 的过滤规则说明：

- 过滤某个合约，如：`eosio.token`
- 过滤某个合约的 action，如：`eosio.token/transfer`


hooks 的 messages 数据说明：

为了方便 hooks 业务研发，传递 messages 时做了优化：

- 满足过滤规则的所有 action 合并成数组传递
- 数组内每一个满足过滤规则的 action 包含 本层 action 以下所有 inline_action，并且如果存在上层 action，将携带 parent 属性，标识上层 parent 的 action 数据。


注：每层 `parent_id` 是该层 `action` 上级的 DB 自增长 id。

举一个返回示例结构：

```
[
  {
    "inline_traces": [
      {
        "parent": ... parent_id => 1
        "inline_traces": [
          {
            "parent": ... parent_id => 2
                "parent": ... parent_id => 1
          },
          {
            "parent": ... parent_id => 2
                "parent": ... parent_id => 1
          }
        ]
      }
    ]
  }
]

```

## Example 快速应用

[Example 源码](./examples)

学习了解 fibos-trakcer 之后，让我们开始动手编写，使用框架写一个区块链数据存储展现的应用。

与 FIBOS 的 emiiter结合，写一个应用。 它可以同步 FIBOS TestNet 网络区块数据，并且使用 GraphQL 获取应用数据。

[FIBOS TestNet WebSite](https://testnet.fibos.fo/#/)：

### 环境准备

1. 快速安装 FIBOS

```
curl -s https://fibos.io/download/installer.sh | sh
```

2. 查看 FIBOS 版本

```
$ fibos //Enter
```

输出：

(不同 FIBOS 版本输出信息不一致)
```
Welcome to FIBOS v1.7.1.8 Based on fibjs 0.29.0-dev.
Type ".help" for more information.
```

3. 准备示例目录

```
 :$ mkdir example;cd example
 :$ fibos --init
 :$ fibos --install fibos-tracker
```

### 编写例子

[genesis.json](./examples/genesis.json) 是 FIBOS TestNet 网络的配置。

[index.js](./examples/index.js):

```
const http = require("http");
const fibos = require("fibos");
const Tracker = require("fibos-tracker");
const tracker = new Tracker();

fibos.config_dir = "./data";
fibos.data_dir = "./data";
fibos.load("http", {
	"http-server-address": "0.0.0.0:8870",
	"access-control-allow-origin": "*",
	"http-validate-host": false,
	"verbose-http-errors": true
});

fibos.load("net", {
	"p2p-peer-address": ["p2p-testnet.fibos.fo:9870"],
	"p2p-listen-endpoint": "0.0.0.0:9870"
});

fibos.load("producer");
fibos.load("chain", {
	"contracts-console": true,
	"delete-all-blocks": true,
	"genesis-json": "genesis.json"
});

fibos.load("chain_api");

tracker.emitter();

fibos.start();

let httpServer = new http.Server("", 8080, [
	(req) => {
		req.session = {};
	}, {
		'^/ping': (req) => {
			req.response.write("pong");
		},
		'/1.0/app': tracker.app,
		"*": [function(req) {}]
	},
	function(req) {}
]);

httpServer.crossDomain = true;
httpServer.asyncRun();
```

### 启动服务

```
fibos index.js
```

### 使用 GraphQL 方式获取应用数据

1. FIBOS GraphQL 客户端

```
const http = require("http");

let graphql = function(body) {
	return http.post(`http://127.0.0.1:8080/1.0/app/`, {
		headers: {
			'Content-Type': 'application/graphql'
		},
		body: body
	});
}
```

2. Web GraphQL 客户端

Jquery Ajax 示例:

```
let graphql = function(body) {
    $.ajax({
        type: "POST",
        url: "http://127.0.0.1:8080/1.0/app",
        data: body,
        headers: {
            "Content-Type": "application/graphql"
        },
        success: (res) => {
            console.log("success");
        },
        error: (res) => {
            console.log("error");
        }
    });
}
```

#### GraphQL 获取应用-列表数据

```
graphql(`
{
    find_blocks(
       	skip: 0,
        limit: 10,
        order: "-id"
    ){
        id,
        block_time,
        block_num,
        producer_block_id,
        producer,
        status,
        createdAt,
        updatedAt
    }
}`)
```

#### GraphQL 获取应用-详情数据

```
graphql(`
{
    find_blocks(
		where:{
			id: 23
		}
	) {
        id,
        block_time,
        block_num,
		producer_block_id,
		producer,
		status,
		createdAt,
		updatedAt,
		transactions{
			id,
			trx_id,
			rawData,
			createdAt,
			updatedAt
		}
    }
}`)
```

## 高级篇-使用 ORM 自定义数据

[Example 源码](./examples)

学习了基础篇的应用，让我们使用 fibos-tracker 的 `use` 完成一个仅监控 eosio.token 合约 transfer 的应用。

### 环境准备

基于上面的环境应用，让我们创建一个目录:

```
:$ mkdir addons;cd addons;
```

### 设计&&定义一个数据模型

设计数据表 eosio_token_transfers：

| 字段                 | 类型 |	备注|
|---------------------|--------|------------|
| id     | Number   | 自增长 id   |
| from | String    |   转出方  |
| to | String    |   转入方  |
| quantity | String    |  交易数量   |
| memo | String    |   memo  |
| createdAt | Date    |   记录创建时间  |
| updatedAt | Date    |   记录更新时间  |


使用 ORM Define 数据表逻辑:

```
let defines = [db => {
	return db.define('eosio_token_transfers', {
		from: {
			required: true,
			type: "text",
			size: 12
		},
		to: {
			required: true,
			type: "text",
			size: 12
		},
		quantity: {
			required: true,
			type: "text",
			size: 256
		},
		memo: {
			type: "text",
			size: 256
		}
	}, {
		hooks: {},
		methods: {},
		validations: {},
		functions: {},
		ACL: function(session) {
			return {
				'*': {
					find: true,
					read: true
				}
			};
		}
	});
}];
```

### 定义 hook 数据监听

hook 监听的 messages 是一组系统排序过滤后的原始区块数据。

tracker.use 需要对 hook 的接受数据进行过滤。

```
let hooks = {
	"eosio.token/transfer": (db, messages) => {
		let eosio_token_transfers = db.models.eosio_token_transfers;
		try {
			db.trans(() => {
				messages.forEach((m) => {
					eosio_token_transfers.createSync(m.act.data);
				});
			});
		} catch (e) {
			console.error("eosio.token/transfer Error:", e);
		}
	}
}
```

### 保存自定义数据模型代码

保存下面代码到 eosio_token_transfers.js：

```
let defines = [db => {
	return db.define('eosio_token_transfers', {
		from: {
			required: true,
			type: "text",
			size: 12
		},
		to: {
			required: true,
			type: "text",
			size: 12
		},
		quantity: {
			required: true,
			type: "text",
			size: 256
		},
		memo: {
			type: "text",
			size: 256
		}
	}, {
		hooks: {},
		methods: {},
		validations: {},
		functions: {},
		ACL: function(session) {
			return {
				'*': {
					find: true,
					read: true
				}
			};
		}
	});
}];

let hooks = {
	"eosio.token/transfer": (db, messages) => {
		let eosio_token_transfers = db.models.eosio_token_transfers;
		try {
			db.trans(() => {
				messages.forEach((m) => {
					eosio_token_transfers.createSync(m.data);
				});
			});
		} catch (e) {
			console.error("eosio.token/transfer Error:", e);
		}
	}
}

module.exports = {
	defines: defines,
	hooks: hooks
}
```

### 使用 fibos-tracker 加载新的数据模型

```
tracker.use(require("./addons/eosio_token_transfers.js"));
```

#### 启动服务&&使用 GraphQL 获取数据

启动服务：
```
fibos index.js
```

查询 eosio_token_transfers 列表：

```
graphql(`
{
    find_eosio_token_transfers(
        skip: 0,
        limit: 10,
        order: "-id"
    ){
        id,
        from,
        to,
        quantity,
        memo,
        createdAt,
        updatedAt
    }
}`)
```