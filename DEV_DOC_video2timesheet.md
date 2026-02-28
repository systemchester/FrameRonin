**产品目标**
- 复刻“视频转序列帧图片生成器（v1.6）”，实现上传视频后自动提取帧、进行抠图处理，并生成一张完整的序列帧表（Sprite Sheet）图片，提供下载与复用能力。

**核心功能**
- 上传视频：支持本地文件上传或视频链接抓取（可选），展示基础元信息（时长、分辨率、帧率）。
- 帧提取：按目标FPS、起止时间或帧范围、采样策略批量导出帧。
- 抠图分割：对每帧进行主体分割，输出透明背景（RGBA），支持抠图强度/细节参数。
- 帧后处理：统一尺寸、居中/对齐、裁剪边界、设置边距与间距，支持背景色或透明。
- 序列帧合成：按固定列数或自适应布局合成一张Sprite Sheet，支持间距、边框、背景色。
- 预览与下载：生成PNG（无损透明），可选ZIP打包（包含PNG与索引JSON）；页面内预览与参数回显。
- 任务管理：异步排队、进度展示、并发控制、重试机制、错误提示。
- 历史与缓存（可选）：近期任务列表、重复视频的结果复用（hash命中）。
- 设置与版本：参数记忆、国际化、版本号显示（例如v1.6）。

**用户流程**
- 第一步 上传：用户选择本地视频或粘贴URL，系统校验并展示基本信息。
- 第二步 设置参数：FPS、起止时间/帧范围、最大帧数、抠图强度、布局（列数/自适应）、统一尺寸、背景色/透明、边距/间距等。
- 第三步 开始处理：创建任务，进入队列；界面显示百分比与关键阶段（提取、抠图、合成）。
- 第四步 查看结果：生成Sprite Sheet与索引；可预览、放大、滚动查看。
- 第五步 下载与复用：下载PNG或ZIP（PNG+JSON索引）；复制索引以应用到游戏/前端。

**系统架构**
- 前端（SPA）：React + Vite + TypeScript；组件化参数面板、上传控件、进度与结果预览；与后端通过HTTP/WebSocket交互。
- 后端（API）：Python FastAPI，统一鉴权与参数校验，提供任务创建/查询/结果下载接口。
- 处理服务（Worker）：基于Redis队列（RQ/Celery）执行重任务；调用FFmpeg帧提取、rembg（U2Net）抠图、Pillow合成。
- 存储层：本地临时目录与持久目录；可选对象存储（S3/兼容）用于结果分发；定期清理策略。
- 消息与队列：Redis用于任务排队、进度更新、去重与状态通知。
- 监控与日志：结构化日志、关键指标采集（处理时长、失败率、CPU/GPU占用）。

**技术选型**
- 前端：React + Vite + TS；UI框架（Ant Design/Chakra可选）；WebSocket用于实时进度。
- 后端：FastAPI（Python 3.11+），Uvicorn/Gunicorn部署。
- 队列：RQ（Redis），或Celery（Redis/Broker）。
- 视频处理：FFmpeg/ffprobe；按时码与帧率精确抽帧。
- 抠图：rembg（U2Net/IsNet），支持批处理；可替MODNet等模型。
- 合成：Pillow（RGBA）；大图合成时注意内存分块与流式写入。
- 可选：ffmpeg.wasm用于浏览器端轻量处理（受限于性能与内存）。

**数据模型**
- Job
  - id：字符串
  - status：queued / processing / completed / failed / canceled
  - progress：0-100
  - params：见下
  - created_at / started_at / finished_at
  - error：可选{code,message}
- Params
  - source：上传文件或URL
  - fps：目标帧率（如1-60）
  - frame_range：起止时间或帧号（如{start_sec,end_sec}）
  - max_frames：上限（如≤1000）
  - target_size：统一尺寸（如{w,h}或按短边/长边）
  - bg_color：#RRGGBB或transparent
  - transparent：布尔；true表示输出透明背景
  - padding：像素；间距：像素
  - layout_mode：fixed_columns / auto_square
  - columns：当layout_mode=fixed_columns时的列数
  - matte_strength：抠图强度/阈值
  - crop_mode：none / tight_bbox / safe_bbox
- Result
  - sprite_sheet_url：PNG路径或下载URL
  - json_index_url：索引JSON路径或下载URL
  - frame_count：整数
  - width / height：合成大图尺寸

**接口设计**
- POST /jobs
  - 请求：multipart/form-data（file）或JSON（{url}），附带params JSON
  - 响应：{job_id}
- GET /jobs/{id}
  - 响应：{status,progress,params,created_at,started_at,finished_at,error?}
- GET /jobs/{id}/result
  - 响应（200）：文件下载（PNG或ZIP）
  - 若ZIP：包含sprite.png与index.json
- DELETE /jobs/{id}
  - 取消任务或删除结果（遵循清理策略）
- 可选：WS /jobs/{id}/events
  - 事件：queued/started/stage(frame_extract/matting/compose)/progress/finished/failed

**请求示例**

```http
POST /jobs
Content-Type: multipart/form-data

file: video.mp4
params: {
  "fps": 12,
  "frame_range": {"start_sec": 0, "end_sec": 5},
  "max_frames": 300,
  "target_size": {"w": 256, "h": 256},
  "transparent": true,
  "padding": 4,
  "layout_mode": "fixed_columns",
  "columns": 12,
  "matte_strength": 0.6,
  "crop_mode": "tight_bbox"
}
```

**索引JSON示例**

```json
{
  "version": "1.0",
  "frame_size": {"w":256,"h":256},
  "sheet_size": {"w":3072,"h":2048},
  "frames": [
    {"i":0,"x":0,"y":0,"w":256,"h":256,"t":0.000},
    {"i":1,"x":256,"y":0,"w":256,"h":256,"t":0.083},
    {"i":2,"x":512,"y":0,"w":256,"h":256,"t":0.167}
  ]
}
```

**处理管线**
- 校验与探测
  - 校验MIME与扩展名；限制文件大小与时长。
  - 使用ffprobe读取时长、分辨率、帧率，校正参数。
- 帧采样策略
  - 根据目标FPS与frame_range计算抽帧时间戳；支持均匀采样与最大帧数限制。
- 帧提取
  - FFmpeg按时间戳导出PNG序列；示例：-ss/-to控制区间，-vf fps=指定帧率。
- 抠图（前景分割）
  - rembg批处理每帧PNG，输出带Alpha通道；可根据matte_strength调整细节。
- 标准化与后处理
  - 计算主体bbox（如按Alpha非空区域）；按crop_mode裁剪或加安全边距。
  - Resize/Pad到target_size；应用padding与背景色/透明。
- 合成布局算法
  - fixed_columns：给定列数C，行数R=ceil(N/C)；sheet_w=C*(w+spacing)-spacing；sheet_h=R*(h+spacing)-spacing。
  - auto_square：C≈ceil(sqrt(N))，取接近方形布局；其余逻辑同上。
  - 逐帧贴图到大画布，记录(x,y,w,h)与原始时间戳t。
- 输出与打包
  - 生成sprite.png（RGBA，PNG无损）；生成index.json。
  - 可选打包zip并返回下载链接；清理中间帧（按策略保留/删除）。

**性能与资源**
- 限制建议：最大上传大小≤200MB；最长时长≤300s；最大帧数≤2000；最大合成尺寸≤16384边。
- 并发与队列：限制并发作业数；单作业内批次处理（如每批128帧）。
- 内存管理：避免一次性加载所有帧；流式读写与分块合成。
- 速度优化：多进程/线程并行（提取与抠图可并行）；I/O与CPU重叠；使用临时SSD目录。
- 缓存与去重：视频内容hash（文件/URL）；命中后复用历史结果。
- 清理策略：TTL到期删除临时与结果；保留最近N个任务。

**质量与测试**
- 单元测试：参数解析、布局坐标计算、索引生成的正确性。
- 集成测试：小/中/大视频的全管线稳定性；边界参数（极低/极高FPS）。
- 视觉测试：抠图质量（毛发/边缘）；透明度与合成观感。
- 性能测试：在限制范围内的处理时间与内存峰值。
- 前端E2E：上传→设置→进度→结果→下载完整流程。

**安全与合规**
- 白名单格式：mp4/mov/webm等；拒绝可疑容器或脚本注入。
- 命令安全：所有子进程参数严格转义与校验。
- 速率限制与防刷：IP级/用户级限流；CSRF/XSS防护。
- 隐私与删除：任务到期自动删除，支持手动删除；不外泄用户素材。
- CORS与鉴权：跨域安全配置；必要时提供令牌鉴权。

**部署与运维**
- 依赖：FFmpeg、rembg模型（U2Net/IsNet）预下载；Python环境与Redis。
- 部署：Docker Compose（web+api+worker+redis+storage）；或单机安装。
- 配置：环境变量（存储路径、队列并发、大小限制、清理TTL）。
- 监控：处理时长、失败率、队列长度；结构化日志与报警。

**验收标准**
- 功能：完成上传、帧提取、抠图、合成、预览与下载全流程。
- 正确性：索引坐标与帧顺序准确；透明输出符合预期。
- 性能：在限制范围内稳定处理，失败率低于设定阈值。
- 体验：参数可控、进度清晰、结果可视；错误信息明确。

**未来扩展**
- 前景编辑：手动蒙版/擦除工具，精修抠图边缘。
- 动效导出：支持GIF/WebP/视频回包；序列帧到动画CSS/JSON。
- 多素材合成：批量视频合成到同一Sprite Sheet。
- 模型切换：允许在不同分割模型间选择（速度/质量权衡）。

**风险与替代方案**
- 抠图表现不佳：提供不同模型或手动微调；支持阈值与边缘平滑。
- 超大视频与超高分辨率：拒绝或分段处理；提示用户降低参数。
