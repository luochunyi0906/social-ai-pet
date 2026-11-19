#import <AppKit/AppKit.h>

// Independent test windows. The production helper sees only their IDs and geometry.
int main(int argc, char **argv) {
 @autoreleasepool {
  NSApplication *app=NSApplication.sharedApplication;
  [app setActivationPolicy:NSApplicationActivationPolicyRegular];
  NSRect visible=NSScreen.mainScreen.visibleFrame;
  BOOL target=argc>1&&strcmp(argv[1],"target")==0;
  BOOL backdrop=argc>1&&strcmp(argv[1],"backdrop")==0;
  CGFloat width=target?MIN(470,visible.size.width*.43):320;
  CGFloat height=target?MIN(310,visible.size.height*.38):190;
  NSRect frame=backdrop?visible:NSMakeRect(visible.origin.x+visible.size.width*(target?.32:.60),
    visible.origin.y+visible.size.height*(target?.22:.15),width,height);
  NSWindowStyleMask mask=backdrop?NSWindowStyleMaskBorderless:
    NSWindowStyleMaskTitled|NSWindowStyleMaskClosable|NSWindowStyleMaskMiniaturizable|NSWindowStyleMaskResizable;
  NSWindow *window=[[NSWindow alloc]initWithContentRect:frame styleMask:mask backing:NSBackingStoreBuffered defer:NO];
  window.title=target?@"攀爬测试窗 A":@"焦点切换测试窗 B";
  window.backgroundColor=[NSColor colorWithRed:0.88 green:0.91 blue:0.93 alpha:1];
  [window makeKeyAndOrderFront:nil];
  [app activateIgnoringOtherApps:YES];
  puts("ready");
  fflush(stdout);
  [app run];
 }
 return 0;
}
