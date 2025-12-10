# 服务器目录与文件关系说明

本文档用于说明项目部署/运维环境中一些常见目录与文件的大致作用和相互关系，便于后续排查问题和做环境迁移。

涉及目录/文件包括（可能因实际环境略有增减）：

- `backups/`
- `database/`
- `dbindex/`
- `docker/`
- `knowledgeindex/`
- `nginx/`
- `rabbitmq/`
- `redis/`
- `screenserver/`
- `scripts/`
- `tomcat/`
- `upload/`
- `websites/`
- `zammad/`
- `docker-compose.yml*`
- `openjdk8.tar`
- 以及若干 `docker-compose.yml.bak*`、`upload.zip` 等备份文件

> 说明：下面是基于通用实践的角色划分，实际内容以服务器上的具体结构为准。

---

## 1. 服务目录（按服务角色）

### 1.1 `nginx/`

- **作用**：Nginx 的配置与数据目录。
- **典型内容**：
  - `nginx.conf`、`conf.d/*.conf`：虚拟主机、反向代理配置。
  - `logs/`：访问日志、错误日志。
  - 如使用本地静态文件部署前端，也可能挂载静态目录。
- **在 docker-compose 中的表现**：
  - 被挂载到 Nginx 容器的 `/etc/nginx`、`/var/log/nginx` 等路径。

### 1.2 `tomcat/`

- **作用**：Tomcat 应用服务器的相关文件。
- **典型内容**：
  - `conf/`：`server.xml`、`context.xml` 等配置。
  - `webapps/`：部署的 `.war` 或解压后的应用。
  - `logs/`：Tomcat 和应用日志。
- **在 docker-compose 中的表现**：
  - 作为 volume 挂载到 Tomcat 容器，以持久化配置和日志。

### 1.3 `redis/`

- **作用**：Redis 缓存服务的持久化目录。
- **典型内容**：
  - `data/`：RDB/AOF 数据文件。
  - `redis.conf`：Redis 配置文件（如持久化策略、密码等）。
- **在 docker-compose 中的表现**：
  - 映射到 Redis 容器的 `/data`、`/usr/local/etc/redis` 等目录。

### 1.4 `rabbitmq/`

- **作用**：RabbitMQ 消息队列的数据与配置目录。
- **典型内容**：
  - `data/`：队列/交换机等元数据和持久化消息。
  - `conf/` 或 `advanced.config` 等。
- **在 docker-compose 中的表现**：
  - 挂载到 RabbitMQ 容器中，保证重启后数据不丢。

### 1.5 `screenserver/`

- **作用**：屏幕投影/屏幕服务相关的独立服务目录。
- **可能内容**：
  - Screen Server 的代码、配置、日志、启动脚本等。
- **关系**：
  - 可能通过 WebSocket/HTTP 与主系统交互，用于「屏幕投影」等功能。
  - 一般由 Docker 或独立脚本在服务器上常驻运行。

### 1.6 `zammad/`

- **作用**：Zammad 工单/客服系统的部署目录。
- **典型内容**：
  - Zammad 应用代码、配置和附件存储（具体结构视部署方式而定）。
- **关系**：
  - 为客服/运维提供工单管理、用户反馈等功能。
  - 通常会依赖 `database/`（数据库）、`redis/`（缓存）等服务。

### 1.7 `docker/`

- **作用**：存放与 Docker 相关的配置、镜像或脚本，是容器化部署的入口目录之一。
- **典型内容**：
  - `docker-compose.yml` 及其备份文件。
  - 环境变量文件（`.env`）、服务的 Dockerfile。
- **关系**：
  - 通过 compose 文件，将 `database/`、`redis/`、`rabbitmq`、`websites/`、`upload/` 等目录挂载为容器的数据卷。

#### 1.7.1 docker-compose 文件族与容器编排

- **`docker-compose.yml`**：当前实际生效的 Docker 编排文件，`docker-compose up -d` 默认使用它。
  - 定义各个服务容器：
    - `nginx`（前端静态资源 + 反向代理）
    - `tomcat`（Java 应用服务）
    - `redis`（缓存）
    - `rabbitmq`（消息队列）
  - 配置端口映射、网络、环境变量。
  - 配置卷挂载（volume），把宿主机目录映射到容器：
    - `./nginx`、`./tomcat`、`./redis`、`./rabbitmq`、`./upload` 等。
- **`docker-compose.yml.org`**：最初的「原始版本」备份（org = original）。
  - 用途：对比当前配置与最初配置的差异，出问题时用于回滚参考。
- **`docker-compose.yml.bak20250313` / `docker-compose.yml.bak20250318`**：
  - 作用：带日期的历史备份版本。
  - 含义：`.bak20250313` 为 2025-03-13 的备份，`.bak20250318` 为 2025-03-18 的备份。
  - 用途：每次对 `docker-compose.yml` 做较大修改前，手动/脚本备份；需要回滚时可直接替换回某个备份版本。

> **关系总结**：  
> - 真正 `docker-compose up -d` 使用的是 `docker-compose.yml`。  
> - `.org` 和 `.bak*` 是不同时间点的配置快照，用于比对和回滚。

---

## 2. 数据与索引相关目录

### 2.1 `database/`

- **作用**：数据库（通常是 MySQL / PostgreSQL）的数据目录。
- **典型内容**：
  - 数据文件、索引文件、事务日志、binlog 等。
- **关系**：
  - 常被映射到数据库容器的 `/var/lib/mysql` 或类似路径。
  - 是业务数据最核心的存储之一，是备份重点（常被打包到 `backups/`）。

### 2.2 `dbindex/`

- **作用**：数据库索引或外部全文索引的单独存放目录。
- **常见用途**：
  - 将数据库索引与数据分盘/分目录存放，提高 IO 性能。
  - 或作为全文检索引擎（如 Elasticsearch / Sphinx）索引文件的专门目录。
- **关系**：
  - 与 `database/` 搭配，决定数据库或查询服务的性能。

### 2.3 `knowledgeindex/`

- **作用**：知识库、题库、知识点搜索等功能的索引存储目录。
- **可能内容**：
  - 教材知识点索引、习题索引、知识图谱关联索引等。
  - 由内部索引组件或外部搜索引擎生成的数据文件。
- **关系**：
  - 与业务中的“知识点搜索”“题目检索”“去练习”等功能紧密相关。
  - 某些情况下可以通过重建索引修复问题。

### 2.4 `redis/`

- **作用**：Redis 缓存服务的数据与配置目录。
- **典型内容**：
  - 持久化文件：`dump.rdb`、`appendonly.aof` 等。
  - `redis.conf` 等配置。
- **关系**：
  - 多由 Docker 容器挂载，重启容器后缓存/会话可持久化（视配置而定）。
  - 业务中常用于会话存储、缓存、分布式锁等功能。

### 2.5 `rabbitmq/`

- **作用**：RabbitMQ 消息队列的数据和配置。
- **典型内容**：
  - 队列、交换机、绑定关系的元数据。
  - 持久化消息存储文件。
- **关系**：
  - 在消息驱动/异步任务架构中扮演核心角色。
  - 通过 Docker 挂载保证重启不丢消息（在启用持久化的前提下）。

---

## 3. Web / 应用服务相关目录

### 3.1 `nginx/`

- **作用**：Nginx 的配置、日志和（可能的）静态资源目录。
- **典型内容**：
  - `nginx.conf`、`conf.d/*.conf`：虚拟主机配置、反向代理规则、SSL 配置等。
  - `logs/`：访问日志、错误日志。
- **关系**：
  - 对外提供 HTTP/HTTPS 入口，反向代理到后台服务（如 Tomcat）。
  - 也可能直接提供前端静态文件（打包后的 `dist/`）。

### 3.2 `tomcat/`

- **作用**：Tomcat 应用服务器环境。
- **典型内容**：
  - `conf/`：`server.xml`、`context.xml`、连接池与线程池配置等。
  - `webapps/`：部署的 WAR 包或解压后的应用目录。
  - `logs/`：Tomcat 和业务日志。
- **关系**：
  - 运行 Java Web 后端应用，与前端、数据库、Redis、RabbitMQ 等交互。
  - 在 Docker 场景下，该目录常作为 Tomcat 容器的挂载卷。

### 3.3 `screenserver/`

- **作用**：屏幕投影/屏幕服务相关的独立服务目录。
- **可能内容**：
  - Screen Server 的代码、配置、日志、启动脚本等。
- **关系**：
  - 可能通过 WebSocket/HTTP 与主系统交互，用于「屏幕投影」等功能。
  - 一般由 Docker 或独立脚本在服务器上常驻运行。

### 3.4 `websites/`

- **作用**：网站/前端应用的统一部署根目录。
- **典型内容**：
  - 一个或多个站点子目录：`websites/site1`、`websites/site2` 等。
  - 各前端项目打包后的 `dist/` 文件。
  - 也可能包含某些简单的静态站点。
- **关系**：
  - Nginx/Tomcat 的根目录通常指向这里的某个子目录。
  - 前端版本更新时，一般是替换此处的打包文件。

### 3.5 `zammad/`

- **作用**：Zammad 工单/客服系统的部署目录。
- **典型内容**：
  - Zammad 应用代码、配置和附件存储（具体结构视部署方式而定）。
- **关系**：
  - 为客服/运维提供工单管理、用户反馈等功能。
  - 通常会依赖 `database/`（数据库）、`redis/`（缓存）等服务。

---

## 4. 业务数据与备份

### 4.1 `upload/`

- **作用**：业务层上传文件的主存储目录。
- **典型内容**：
  - 用户上传的图片、PDF、文档、视频等。
  - 系统导出的报表或其他生成文件。
- **关系**：
  - 后端服务（如 Tomcat 中的应用）通过挂载卷读写该目录。
  - Nginx 可能配置静态资源规则，直接对外提供该目录下的文件下载。

### 4.2 `backups/`

- **作用**：统一备份目录。
- **可能包含**：
  - 数据库备份（SQL、压缩包）。
  - `upload/` 目录的周期性打包备份。
  - `knowledgeindex/`、`redis`、`rabbitmq` 等关键数据的备份。
- **关系**：
  - 通常由 `scripts/` 中的备份脚本配合定时任务（cron）定期写入。
  - 是灾备和迁移时的主要数据来源之一。

### 4.3 `upload.zip`

- **作用**：`upload/` 目录在某个时间点的打包备份。
- **用途**：
  - 迁移服务器时快速导入上传文件。
  - 数据损坏或误删后进行恢复。

---

## 5. 运维脚本

### 5.1 `scripts/`

- **作用**：存放各类运维/管理脚本。
- **常见脚本类型**：
  - 启动/停止/重启服务脚本：`start.sh`、`stop.sh`、`restart.sh`。
  - 备份脚本：`backup_db.sh`、`backup_all.sh`，将数据打包到 `backups/`。
  - 日志清理脚本：定期删除过期日志，避免磁盘占满。
  - 索引重建脚本：针对 `knowledgeindex/` 等场景。
- **关系**：
  - 常配合 `crontab` 或系统服务使用，实现自动化运维。

---

## 6. 整体关系概览（示意）

```text
docker/               ← Docker/容器编排入口
  ├─ docker-compose.yml         ← 当前生效的编排
  ├─ docker-compose.yml.org     ← 最初版本备份
  └─ docker-compose.yml.bak*    ← 历史改动前的备份

服务依赖的数据卷：
  ├─ database/       ← 数据库数据
  ├─ dbindex/        ← 数据库/全文索引
  ├─ redis/          ← Redis 数据
  ├─ rabbitmq/       ← MQ 数据
  ├─ knowledgeindex/ ← 知识/题库搜索索引
  ├─ upload/         ← 业务上传文件
  └─ websites/       ← 前端/网站部署根目录

应用与服务：
  ├─ nginx/          ← Web 入口与反向代理
  ├─ tomcat/         ← Java Web 应用容器环境
  ├─ screenserver/   ← 屏幕投影等独立服务
  └─ zammad/         ← 工单/客服系统

运维与备份：
  ├─ scripts/        ← 启停、备份、清理等脚本
  ├─ backups/        ← 统一备份目录
  ├─ upload.zip      ← upload/ 某次打包备份
  └─ openjdk8.tar    ← JDK8 离线包/镜像基础
```

---

## 7. 使用建议

- **修改 compose 前先备份**：
  - 对 `docker-compose.yml` 进行重要改动前，复制一份为 `docker-compose.yml.bakYYYYMMDD`。
- **定期检查备份有效性**：
  - 确保 `backups/` 中最近的备份可用（能解压、能恢复到测试环境）。
- **区分“在线数据”与“备份数据”**：
  - `database/`、`upload/` 等是在线数据目录；
  - `backups/`、`upload.zip` 等为备份，避免误操作覆盖或删除。
- **为本文件建立习惯**：
  - 如有新目录或服务引入，建议同步更新本说明文档，减少后期沟通成本。
