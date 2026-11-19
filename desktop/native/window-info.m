#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>

static NSDictionary *metadata(NSDictionary *row, int selfPID) {
    NSNumber *pid=row[(id)kCGWindowOwnerPID];
    int layer=[row[(id)kCGWindowLayer] intValue];
    BOOL appWindow=layer==CGWindowLevelForKey(kCGNormalWindowLevelKey) ||
        layer==CGWindowLevelForKey(kCGFloatingWindowLevelKey) ||
        layer==CGWindowLevelForKey(kCGModalPanelWindowLevelKey);
    if (pid.intValue==selfPID || !appWindow ||
        [row[(id)kCGWindowAlpha] doubleValue]<0.25) return nil;
    CGRect box;
    if (!CGRectMakeWithDictionaryRepresentation((__bridge CFDictionaryRef)row[(id)kCGWindowBounds], &box) ||
        box.size.width<240 || box.size.height<160) return nil;
    return @{@"id":row[(id)kCGWindowNumber],@"pid":pid,@"x":@(box.origin.x),@"y":@(box.origin.y),
      @"width":@(box.size.width),@"height":@(box.size.height)};
}
int main(int argc, char **argv) {
    @autoreleasepool {
        int selfPID=argc>1?atoi(argv[1]):0;
        int targetID=argc>2?atoi(argv[2]):0;
        int activePID=NSWorkspace.sharedWorkspace.frontmostApplication.processIdentifier;
        NSArray *list=CFBridgingRelease(CGWindowListCopyWindowInfo(
            kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,kCGNullWindowID));
        NSDictionary *first=nil,*active=nil,*target=nil;
        NSMutableArray *candidates=[NSMutableArray array];
        for (NSDictionary *row in list) {
            NSDictionary *window=metadata(row,selfPID);
            if (!window) continue;
            if (!first) first=window;
            if (!active && [window[@"pid"] intValue]==activePID) active=window;
            if (targetID && [window[@"id"] intValue]==targetID) target=window;
            if (!targetID && candidates.count<48) [candidates addObject:window];
            if (active && (targetID?target!=nil:candidates.count>=48)) break;
        }
        NSDictionary *response=@{@"activePID":@(activePID),@"selfActive":@(activePID==selfPID),
            @"front":active?:NSNull.null,@"target":target?:NSNull.null,
            @"candidate":(active?:first)?:NSNull.null,@"candidates":candidates};
        NSData *bytes=[NSJSONSerialization dataWithJSONObject:response options:0 error:NULL];
        if (!bytes) return 2;
        fwrite(bytes.bytes,1,bytes.length,stdout);
    }
    return 0;
}
