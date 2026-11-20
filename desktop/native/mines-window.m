#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <ScreenCaptureKit/ScreenCaptureKit.h>

static const NSString *bundleID=@"com.morecats.Minesweeper";
static NSString *appPath=@"/Applications/Minesweeper.app";

static NSRunningApplication *target(void) {
 for (NSRunningApplication *app in [NSRunningApplication runningApplicationsWithBundleIdentifier:(NSString *)bundleID]) {
  if ([app.bundleURL.path.stringByResolvingSymlinksInPath isEqualToString:appPath]) return app;
 }
 return nil;
}

static void emit(NSDictionary *value) {
 NSData *json=[NSJSONSerialization dataWithJSONObject:value options:0 error:NULL];
 if(json)fwrite(json.bytes,1,json.length,stdout);
 fputc('\n',stdout);
 fflush(stdout);
}

static NSArray *windows(pid_t pid) {
 NSMutableArray *result=[NSMutableArray array];
 NSArray *rows=CFBridgingRelease(CGWindowListCopyWindowInfo(kCGWindowListOptionAll|kCGWindowListExcludeDesktopElements,kCGNullWindowID));
 for (NSDictionary *row in rows) {
  if ([row[(__bridge NSString *)kCGWindowOwnerPID] intValue]!=pid||
    [row[(__bridge NSString *)kCGWindowLayer] intValue]!=0) continue;
  CGRect box;
  if (!CGRectMakeWithDictionaryRepresentation((__bridge CFDictionaryRef)row[(__bridge NSString *)kCGWindowBounds],&box)||
      box.size.width<150||box.size.height<155) continue;
  [result addObject:@{@"id":row[(__bridge NSString *)kCGWindowNumber],@"x":@(box.origin.x),@"y":@(box.origin.y),
   @"width":@(box.size.width),@"height":@(box.size.height),@"visible":@([row[(__bridge NSString *)kCGWindowIsOnscreen] boolValue])}];
 }
 return result;
}

static NSDictionary *snapshot(void) {
 NSRunningApplication *app=target();
 NSInteger front=NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier;
 if (!app) return @{@"pid":@0,@"front":@(front)};
 return @{@"pid":@(app.processIdentifier),@"front":@(front),@"hidden":@(app.hidden),
   @"permission":@(CGPreflightScreenCaptureAccess()),@"windows":windows(app.processIdentifier),
   @"started":@((long long)(app.launchDate.timeIntervalSince1970*1000))};
}

int main(int argc,const char **argv) {
 @autoreleasepool {
  [NSApplication sharedApplication];
  CGMainDisplayID();
  if (argc>1&&!strcmp(argv[1],"watch")) {
   NSNotificationCenter *center=NSWorkspace.sharedWorkspace.notificationCenter;
   NSArray *events=@[NSWorkspaceDidLaunchApplicationNotification, NSWorkspaceDidActivateApplicationNotification,
    NSWorkspaceDidTerminateApplicationNotification,NSWorkspaceDidHideApplicationNotification,NSWorkspaceDidUnhideApplicationNotification];
   for (NSString *event in events) [center addObserverForName:event object:nil queue:NSOperationQueue.mainQueue
    usingBlock:^(NSNotification *notification) {
     NSRunningApplication *changed=notification.userInfo[NSWorkspaceApplicationKey];
     if ([event isEqualToString:NSWorkspaceDidActivateApplicationNotification]||
         [changed.bundleIdentifier isEqualToString:(NSString *)bundleID]) emit(@{@"change":@YES});
    }];
   emit(@{@"change":@YES});
   [[NSRunLoop mainRunLoop] run];
   return 0;
  }
  NSDictionary *state=snapshot();
  if (argc!=3||![state[@"permission"] boolValue]||[state[@"pid"] intValue]!=[state[@"front"] intValue]||
     [state[@"hidden"] boolValue]||![target() isFinishedLaunching]) {emit(state);return 0;}
  NSInteger windowID=atoi(argv[2]);
  NSDictionary *match=nil;
  for (NSDictionary *window in state[@"windows"]) {
   if (![window[@"visible"] boolValue]) continue;
   if (windowID==0||[window[@"id"] intValue]==windowID) {match=window;break;}
  }
  if (!match) {emit(state);return 0;}
  if (@available(macOS 14.0,*)) {
   [SCShareableContent getShareableContentExcludingDesktopWindows:YES onScreenWindowsOnly:YES completionHandler:^(SCShareableContent *content,NSError *error){
    for (SCWindow *window in content.windows) {
     pid_t pid=[state[@"pid"] intValue];
     if (window.windowID!=[match[@"id"] intValue]||window.owningApplication.processID!=pid||
       NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier!=pid||
       target().processIdentifier!=pid) continue;
     SCContentFilter *filter=[[SCContentFilter alloc] initWithDesktopIndependentWindow:window];
     SCStreamConfiguration *config=[SCStreamConfiguration new];
     double scale=MIN(2,2000/MAX(window.frame.size.width,window.frame.size.height));
     config.width=(size_t)round(window.frame.size.width*scale);
     config.height=(size_t)round(window.frame.size.height*scale);
     config.showsCursor=NO;
     config.ignoreShadowsSingleWindow=YES;
     [SCScreenshotManager captureImageWithFilter:filter configuration:config completionHandler:^(CGImageRef image,NSError *failure){
      if (!image||NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier!=pid||target().processIdentifier!=pid) {emit(snapshot());exit(0);}
      NSData *data=[[[NSBitmapImageRep alloc] initWithCGImage:image] representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
      NSMutableDictionary *result=[snapshot() mutableCopy];
      result[@"captured"]=match[@"id"];
      if (data) result[@"image"]=[data base64EncodedStringWithOptions:0];
      emit(result);
      exit(0);
     }];
     return;
    }
    emit(snapshot());exit(0);
   }];
   [[NSRunLoop mainRunLoop] run];
  } else emit(state);
 }
 return 0;
}
