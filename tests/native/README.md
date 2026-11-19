# 原生穿透测试

pointer-target.m为自建无网络Cocoa窗口，只含计数按钮和滚动文本，不读取用户数据。经CUA把真实点击与滚动放在桌宠透明空隙验证。v0.6实际计数0→1、滚动0→0.813765；记录见docs/V06_DELIVERY.md。编译需对应Mac SDK与Command Line Tools，测试.app不进入产品。
