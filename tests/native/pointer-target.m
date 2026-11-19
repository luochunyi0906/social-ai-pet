#import <Cocoa/Cocoa.h>
@interface Fixture:NSObject<NSApplicationDelegate>
@property NSWindow *window;@property NSButton *button;@property NSInteger count;
@end
@implementation Fixture
-(void)clicked:(id)sender{self.count++;self.button.title=[NSString stringWithFormat:@"透传点击 %ld",(long)self.count];}
-(void)applicationDidFinishLaunching:(NSNotification*)note{NSRect area=NSScreen.mainScreen.visibleFrame;self.window=[[NSWindow alloc]initWithContentRect:NSMakeRect(NSMaxX(area)-560,NSMinY(area)+10,560,370) styleMask:NSWindowStyleMaskTitled|NSWindowStyleMaskClosable backing:NSBackingStoreBuffered defer:NO];self.window.title=@"看山透明穿透验收窗口";self.window.backgroundColor=[NSColor colorWithRed:0.62 green:0.84 blue:0.91 alpha:1];self.button=[[NSButton alloc]initWithFrame:NSMakeRect(330,210,135,34)];self.button.title=@"透传点击 0";self.button.bezelStyle=NSBezelStyleRounded;self.button.target=self;self.button.action=@selector(clicked:);[self.window.contentView addSubview:self.button];NSScrollView*scroll=[[NSScrollView alloc]initWithFrame:NSMakeRect(470,25,75,220)];scroll.hasVerticalScroller=YES;NSTextView*text=[[NSTextView alloc]initWithFrame:NSMakeRect(0,0,65,1400)];NSMutableString*value=[NSMutableString string];for(int i=1;i<=50;i++)[value appendFormat:@"行 %d\n",i];text.string=value;text.editable=NO;scroll.documentView=text;[self.window.contentView addSubview:scroll];[self.window makeKeyAndOrderFront:nil];[NSApp activateIgnoringOtherApps:YES];}
-(BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication*)sender{return YES;}
@end
int main(){@autoreleasepool{NSApplication*app=[NSApplication sharedApplication];Fixture*fixture=[Fixture new];app.delegate=fixture;[app setActivationPolicy:NSApplicationActivationPolicyRegular];[app run];}return 0;}
