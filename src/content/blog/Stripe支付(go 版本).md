---
author: Vanyongqi
pubDatetime: 2025-02-06T18:57:52.737Z
title: Stripe支付(go 版本)
featured: false
draft: false
tags:
  - 支付方案
description: 接入stripe支付方案,所在项目需要接入Stripe支付平台,做个调研,并提供案例demo.
modDatetime: 2025-02-07T02:14:13.374Z
---
>我想这应该是一个全流程的记录贴,包含我解决问题的思路与方式.

因为所在项目要接入Stripe支付方案,我之前恰好做过一点paypal的支付账单的显示功能.(真该死,我也是稀里糊涂实现的,啥也不会呢)


## 目录
- [1. Stripe 简介](#1-stripe-简介)
- [2. 环境准备](#2-环境准备)
- [3. 基本概念](#3-基本概念)
- [4. 实现步骤](#4-实现步骤)
- [5. 代码示例](#5-代码示例)
- [6. 注意事项](#6-注意事项)

## 1. Stripe 简介
Stripe 是一个国际支付平台，支持多种支付方式和货币，提供了完整的支付解决方案。主要特点：
- 支持信用卡、借记卡等多种支付方式
- 支持 150+ 种货币
- 提供完善的 API 和文档
- 安全性高，符合 PCI DSS 标准
- 支持订阅付费模式
- 提供详细的交易报告和分析

## 2. 环境准备

### 2.1 Stripe支付环境准备
1. 访问 [Stripe官网](https://stripe.com) 注册账户
个人账户设置改成中文
![Stripe注册界面](../../assets/images/Stripe支付(go%20版本)/image.png)

2. 获取 API 密钥（测试环境和生产环境各有一套）
   - Publishable key: 用于前端
   - Secret key: 用于后端进行验证
![Stripe注册界面](../../assets/images/Stripe支付(go%20版本)/pubkey.png)

3. 设置产品的价格ID
- 创建对应产品的价格
![Stripe产品界面](../../assets/images/Stripe支付(go%20版本)/imagePrice.png)
- 创建完后,记录所设置产品的ID
![Stripe产品界面](../../assets/images/Stripe支付(go%20版本)/imagePriceId.png)

### 2.2 Stripe支付Demo
**核心逻辑**
- 创建一个env环境变量,用于存储stripe支付的密钥以及对应的产品价格信息
- 创建一个前端页面,用于展示编辑数量,模拟请求和跳转的路径
- 创建一个后端服务,用于处理前端页面的请求(核心)
    1. 设置重定向页面
    2. 获取重定向的链接
    3. 配置 Webhook

        - 登录 Stripe Dashboard
        - 在 Developers → Webhooks 中添加 endpoint
        - 设置 endpoint URL 为： 你的域名/webhook
        - 选择要监听的事件（至少需要 checkout.session.completed

**demo项目文件结构**
```bash
.
├── go.mod
├── go.sum
├── public
│   ├── index.html
│   └── success.html
└── server.go
2 directories, 6 files
 ```
**.env**
```bash
STRIPE_SECRET_KEY=sk_test_51Qhqkz02n8o7RJg7So5y5Y4HtVJHdRfS24nYEiKegOT3NFD8RQsVaI6YfsmJoVvM0qd2ukGjpKVs6XkhPNehX0pG00WNqWL8GI
STRIPE_PUBLISHABLE_KEY=pk_test_51Qhqkz02n8o7RJg7AVwaQIyGLUkDwWpFktBM6mEI4wGVKefNmVLNFGzotS636l0wPbjxVrYngl2CjLgmExkYtEyw00nwbvYyYo
PRICE=price_1QiBmF02n8o7RJg7H3uitU7v
DOMAIN=http://localhost:4242
STATIC_DIR=./public
```
**server.go**
```go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/joho/godotenv"
	"github.com/stripe/stripe-go/v72"
	"github.com/stripe/stripe-go/v72/checkout/session"
	"github.com/stripe/stripe-go/v72/webhook"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}
	checkEnv()

	stripe.Key = os.Getenv("STRIPE_SECRET_KEY")

	http.Handle("/", http.FileServer(http.Dir(os.Getenv("STATIC_DIR"))))
	http.HandleFunc("/create-checkout-session", handleCreateCheckoutSession)
	http.HandleFunc("/webhook", handleWebhook)

	log.Println("server running at 0.0.0.0:4242")
	http.ListenAndServe("0.0.0.0:4242", nil)
}
type ErrorResponseMessage struct {
	Message string `json:"message"`
}

type ErrorResponse struct {
	Error *ErrorResponseMessage `json:"error"`
}

func handleCreateCheckoutSession(w http.ResponseWriter, r *http.Request) {
	// 1. 解析购买数量
	r.ParseForm()
	quantity, err := strconv.ParseInt(r.PostFormValue("quantity")[0:], 10, 64)
	if err != nil {
		http.Error(w, fmt.Sprintf("error parsing quantity %v", err.Error()), http.StatusInternalServerError)
		return
	}

	// 2. 获取域名用于构建回调 URL
	domainURL := os.Getenv("DOMAIN")

	// 3. 创建 Stripe 结账会话
	params := &stripe.CheckoutSessionParams{
		// 支付成功后跳转的 URL
		SuccessURL: stripe.String(domainURL + "/success.html?session_id={CHECKOUT_SESSION_ID}"),
		// 取消支付后跳转的 URL
		CancelURL: stripe.String(domainURL + "/canceled.html"),
		// 设置支付模式
		Mode: stripe.String(string(stripe.CheckoutSessionModePayment)),
		// 设置商品信息
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Quantity: stripe.Int64(quantity),            // 购买数量
				Price:    stripe.String(os.Getenv("PRICE")), // 商品价格 ID
			},
		},
	}

	// 4. 调用 Stripe API 创建会话
	s, err := session.New(params)
	if err != nil {
		http.Error(w, fmt.Sprintf("error while creating session %v", err.Error()), http.StatusInternalServerError)
		return
	}

	// 5. 记录重定向 URL
	log.Printf("Redirecting to: %s", s.URL)

	// 6. 重定向用户到 Stripe 支付页面
	http.Redirect(w, r, s.URL, http.StatusSeeOther)
}

func handleWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	b, err := ioutil.ReadAll(r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		log.Printf("ioutil.ReadAll: %v", err)
		return
	}

	// Verify the webhook signature
	event, err := webhook.ConstructEvent(b, r.Header.Get("Stripe-Signature"), os.Getenv("STRIPE_WEBHOOK_SECRET"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		log.Printf("webhook.ConstructEvent: %v", err)
		return
	}

	// Handle the event
	switch event.Type {
	case "checkout.session.completed":
		var session stripe.CheckoutSession
		if err := json.Unmarshal(event.Data.Raw, &session); err != nil {
			log.Printf("Error parsing checkout session: %v\n", err)
			http.Error(w, "Failed to parse session", http.StatusBadRequest)
			return
		}
		log.Printf("Payment succeeded for session ID: %s\n", session.ID)
		// Here you can update your database or trigger other actions
	}

	writeJSON(w, nil)
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(v); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		log.Printf("json.NewEncoder.Encode: %v", err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if _, err := io.Copy(w, &buf); err != nil {
		log.Printf("io.Copy: %v", err)
		return
	}
}

func writeJSONError(w http.ResponseWriter, v interface{}, code int) {
	w.WriteHeader(code)
	writeJSON(w, v)
	return
}

func writeJSONErrorMessage(w http.ResponseWriter, message string, code int) {
	resp := &ErrorResponse{
		Error: &ErrorResponseMessage{
			Message: message,
		},
	}
	writeJSONError(w, resp, code)
}

func checkEnv() {
	price := os.Getenv("PRICE")
	if price == "price_12345" || price == "" {
		log.Fatal("You must set a Price ID from your Stripe account. See the README for instructions.")
	}
}

```

**index.html**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stripe Checkout Demo</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            text-align: center;
        }
        h1 {
            margin-bottom: 1rem;
            font-size: 1.5rem;
            color: #333;
        }
        input {
            width: 100%;
            padding: 0.5rem;
            margin: 0.5rem 0;
            font-size: 1rem;
            border: 1px solid #ccc;
            border-radius: 4px;
        }
        button {
            background-color: #6772e5;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 1rem;
        }
        button:hover {
            background-color: #5469d4;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Stripe Checkout Demo</h1>
        <p>Enter the quantity you'd like to purchase:</p>
        <input type="number" id="quantity" value="1" min="1">
        <button id="checkout-button">Checkout</button>
    </div>

    <script>
        document.getElementById('checkout-button').addEventListener('click', async () => {
            const quantity = document.getElementById('quantity').value;
            console.log("Quantity:", quantity);

            try {
                // 创建表单并提交
                const form = document.createElement('form');
                form.method = 'POST';
                form.action = '/create-checkout-session';
                
                const quantityInput = document.createElement('input');
                quantityInput.type = 'hidden';
                quantityInput.name = 'quantity';
                quantityInput.value = quantity;
                
                form.appendChild(quantityInput);
                document.body.appendChild(form);
                form.submit();
                
            } catch (error) {
                console.error("Error:", error);
                alert("发生错误，请重试。");
            }
        });
    </script>
</body>
</html>
```
**success.html**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Successful</title>
</head>
<body>
    <h1>Payment Successful!</h1>
    <p>Thank you for your purchase.</p>
    <p>Session ID: <span id="session-id"></span></p>

    <script>
        // 从 URL 中获取 session_id
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');
        document.getElementById('session-id').textContent = sessionId;
    </script>
</body>
</html>
```

## 3. 基本概念
### 3.1 Payment Intent
- 支付意图，表示一次支付尝试
- 包含支付金额、货币、支付方式等信息
- 可以追踪支付状态
### 3.2 Customer
- 客户对象，代表您的用户
- 可以保存支付方式，便于重复支付
- 支持查看交易历史
### 3.3 Payment Method
- 支付方式，如信用卡、支付宝等
- 可以与 Customer 关联
- 支持多种支付渠道
### 3.4 Webhook
- 用于接收 Stripe 的事件通知
- 处理异步支付结果
- 确保支付状态同步
## 4. 实现步骤
### 4.1 初始化配置
1. 设置 API 密钥
2. 配置 Webhook 接收地址
3. 设置货币和支付方式
### 4.2 创建支付流程
1. 创建 Customer（可选）
2. 创建 Payment Intent
3. 确认支付
4. 处理支付结果
### 4.3 处理 Webhook
1. 验证 Webhook 签名
2. 处理支付成功事件
3. 处理支付失败事件
4. 更新订单状态
## 5. 代码示例
### 5.1 初始化 Stripe
```go
package payment

import (
    "github.com/stripe/stripe-go/v72"
    "os"
)

func init() {
    // 设置 API 密钥
    stripe.Key = os.Getenv("STRIPE_SECRET_KEY")
}
 ```

### 5.2 创建支付意图
```go
package payment

import (
    "github.com/stripe/stripe-go/v72"
    "github.com/stripe/stripe-go/v72/paymentintent"
)

func CreatePaymentIntent(amount int64, currency string) (*stripe.PaymentIntent, error) {
    params := &stripe.PaymentIntentParams{
        Amount:   stripe.Int64(amount),
        Currency: stripe.String(currency),
        PaymentMethodTypes: []*string{
            stripe.String("card"),
            stripe.String("alipay"),
        },
    }

    return paymentintent.New(params)
}
 ```


### 5.3 创建客户
```go
package payment

import (
    "github.com/stripe/stripe-go/v72"
    "github.com/stripe/stripe-go/v72/customer"
)

func CreateCustomer(email, name string) (*stripe.Customer, error) {
    params := &stripe.CustomerParams{
        Email: stripe.String(email),
        Name:  stripe.String(name),
    }

    return customer.New(params)
}
 ```


### 5.4 处理 Webhook
```go
package payment

import (
    "github.com/stripe/stripe-go/v72/webhook"
    "net/http"
)

func HandleWebhook(w http.ResponseWriter, req *http.Request) {
    const webhookSecret = "whsec_xxx" // 从环境变量获取

    // 读取请求体
    payload, err := io.ReadAll(req.Body)
    if err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    // 验证签名
    event, err := webhook.ConstructEvent(payload, req.Header.Get("Stripe-Signature"), webhookSecret)
    if err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }

    // 处理事件
    switch event.Type {
    case "payment_intent.succeeded":
        handlePaymentSuccess(event.Data.Object)
    case "payment_intent.payment_failed":
        handlePaymentFailure(event.Data.Object)
    default:
        // 处理其他事件
    }

    w.WriteHeader(http.StatusOK)
}
 ```


### 5.5 完整支付流程示例
```go
package payment

import (
    "github.com/stripe/stripe-go/v72"
    "github.com/gin-gonic/gin"
)

type PaymentRequest struct {
    Amount   int64  `json:"amount"`
    Currency string `json:"currency"`
    Email    string `json:"email"`
}

func ProcessPayment(c *gin.Context) {
    var req PaymentRequest
    if err := c.BindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }

    // 1. 创建或获取客户
    customer, err := CreateCustomer(req.Email, "")
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }

    // 2. 创建支付意图
    params := &stripe.PaymentIntentParams{
        Amount:   stripe.Int64(req.Amount),
        Currency: stripe.String(req.Currency),
        Customer: stripe.String(customer.ID),
        AutomaticPaymentMethods: &stripe.PaymentIntentAutomaticPaymentMethodsParams{
            Enabled: stripe.Bool(true),
        },
    }

    pi, err := CreatePaymentIntent(req.Amount, req.Currency)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }

    // 3. 返回客户端所需信息
    c.JSON(200, gin.H{
        "clientSecret": pi.ClientSecret,
        "customerId":   customer.ID,
    })
}
 ```

## 6. 注意事项
### 6.1 安全性
- 永远不要在前端暴露 Secret Key
- 使用 HTTPS 进行通信
- 验证所有 Webhook 签名
- 实现请求速率限制
### 6.2 错误处理
- 妥善处理支付失败情况
- 实现重试机制
- 记录详细的错误日志
- 设置监控告警
### 6.3 测试
- 使用测试模式进行开发
- 使用测试卡号进行测试
- 模拟各种支付场景
- 测试 Webhook 处理
### 6.4 生产环境
- 使用环境变量管理密钥
- 实现完整的日志系统
- 做好数据备份
- 监控系统状态
### 6.5 合规性
- 遵守 PCI DSS 标准
- 保护用户隐私
- 遵守当地支付法规
- 实现退款机制

> 昨天看了对象公司要求看的一本书《请给我结果》,还蛮有收获.所谓知易行难,就是理论指导的局限性与实际操作的复杂性之间的矛盾.
按照书中所说,我决定将这个任务拆分成事前、事中、事后,三个步骤进行归档记录.
## 一、事前 分析问题,决定的事情就不要改变
要实现Stripe的支付接入FOFA,今天的目标就是接入进测试环境(结果提前).
拆分成三件事:
- 验证Stripe的demo
- 接入FOFA的项目代码中
- 进入开发环境进行实际功能验证

三件事都完成就说明我今天的任务完成了.

## 二、事中 解决问题,记录自己的处理流程
任务1的主逻辑:
1. 注册Stripe账户,这是因为stripe支付需要获取对应的KEY,包括公钥、私钥、以及商品的价格ID
2. 掌握Stripe的支付流程,创建支付步骤需要如下操作
 - 设置回调的URL地址 
 - 设置支付成功or失败的回调地址以及商品的购买数量与商品价格ID.
 - 调用Stripe API创建支付会话等待返回的重定向URL
 - 跳转到重定向URL进行支付
 - 支付成功or失败后 返回对应的处理(这个时候应该纳入数据记账,并发放对应的支付订单)
任务二的主逻辑:
参考paypal的支付代码进行实践

任务三的主逻辑:
与前端联动调试
## 三、 事后 总结,复盘,总结
to write.