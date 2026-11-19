#import <Foundation/Foundation.h>
#import <CoreAudio/CoreAudio.h>
#import <dispatch/dispatch.h>

static const AudioObjectPropertyAddress defaultOutput = {
    kAudioHardwarePropertyDefaultOutputDevice, kAudioObjectPropertyScopeGlobal, kAudioObjectPropertyElementMain
};

static UInt32 readValue(AudioObjectID object, AudioObjectPropertySelector property, AudioObjectPropertyScope scope) {
    AudioObjectPropertyAddress a = { property, scope, kAudioObjectPropertyElementMain };
    UInt32 value = 0, size = sizeof(value);
    return AudioObjectGetPropertyData(object, &a, 0, NULL, &size, &value) == noErr ? value : 0;
}

static BOOL knownHeadphones(NSString *name) {
    return name && [name rangeOfString:@"airpods|headphones?|headsets?|earbuds?|earphones?|耳机|耳機|イヤホン|ヘッドフォン|WH-[A-Z0-9]+|WF-[A-Z0-9]+|beats (studio|solo|fit|flex)|powerbeats|quietcomfort"
                                    options:NSRegularExpressionSearch | NSCaseInsensitiveSearch].location != NSNotFound;
}

static const char *outputKind(AudioDeviceID device) {
    if (!device) return "unknown";
    const UInt32 transport = readValue(device, kAudioDevicePropertyTransportType, kAudioObjectPropertyScopeGlobal);
    const UInt32 source = readValue(device, kAudioDevicePropertyDataSource, kAudioDevicePropertyScopeOutput);
    if (source == 'hdpn' || source == 'hdph') return "headphones";
    if (source == 'ispk' || source == 'spkr') return "other";

    BOOL phoneTerminal = NO, otherTerminal = NO;
    AudioObjectPropertyAddress streams = {
        kAudioDevicePropertyStreams, kAudioDevicePropertyScopeOutput, kAudioObjectPropertyElementMain
    };
    UInt32 size = 0;
    if (AudioObjectGetPropertyDataSize(device, &streams, 0, NULL, &size) == noErr && size > 0 && size <= 1024) {
        AudioStreamID ids[256];
        if (AudioObjectGetPropertyData(device, &streams, 0, NULL, &size, ids) == noErr) {
            for (UInt32 i = 0; i < size / sizeof(AudioStreamID); i++) {
                UInt32 type = readValue(ids[i], kAudioStreamPropertyTerminalType, kAudioObjectPropertyScopeGlobal);
                phoneTerminal |= type == kAudioStreamTerminalTypeHeadphones;
                otherTerminal |= type == kAudioStreamTerminalTypeSpeaker || type == kAudioStreamTerminalTypeReceiverSpeaker;
            }
        }
    }
    if (phoneTerminal && !otherTerminal) return "headphones";
    if (otherTerminal && !phoneTerminal) return "other";
    if (transport == kAudioDeviceTransportTypeBuiltIn || transport == kAudioDeviceTransportTypeHDMI ||
        transport == kAudioDeviceTransportTypeDisplayPort || transport == kAudioDeviceTransportTypeAirPlay) return "other";
    if (transport == kAudioDeviceTransportTypeBluetooth || transport == kAudioDeviceTransportTypeBluetoothLE ||
        transport == kAudioDeviceTransportTypeUSB) {
        AudioObjectPropertyAddress nameAddress = { kAudioObjectPropertyName, kAudioObjectPropertyScopeGlobal, kAudioObjectPropertyElementMain };
        CFStringRef raw = NULL;
        size = sizeof(raw);
        if (AudioObjectGetPropertyData(device, &nameAddress, 0, NULL, &size, &raw) == noErr && raw) {
            NSString *name = CFBridgingRelease(raw);
            if (knownHeadphones(name)) return "headphones";
        }
    }
    return "unknown";
}

static void snapshot(void) {
    @autoreleasepool {
        static AudioDeviceID previous = UINT32_MAX;
        static const char *previousKind = "";
        AudioDeviceID device = readValue(kAudioObjectSystemObject, defaultOutput.mSelector, defaultOutput.mScope);
        const char *kind = outputKind(device);
        if (device == previous && strcmp(kind, previousKind) == 0) return;
        previous = device;
        previousKind = kind;
        printf("{\"device\":%u,\"output\":\"%s\"}\n", device, kind);
        fflush(stdout);
    }
}

int main(int argc, const char **argv) {
    @autoreleasepool {
        snapshot();
        if (argc > 1 && strcmp(argv[1], "--once") == 0) return 0;
        dispatch_queue_t queue = dispatch_queue_create("kanshan.audio.route", DISPATCH_QUEUE_SERIAL);
        AudioObjectAddPropertyListenerBlock(kAudioObjectSystemObject, &defaultOutput, queue,
                                             ^(UInt32 count, const AudioObjectPropertyAddress addresses[]) { snapshot(); });
        // Some jack drivers change the source of the same device without replacing its ID.
        dispatch_source_t timer = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER, 0, 0, queue);
        dispatch_source_set_timer(timer, dispatch_time(DISPATCH_TIME_NOW, NSEC_PER_SEC / 2), NSEC_PER_SEC / 2, NSEC_PER_SEC / 20);
        dispatch_source_set_event_handler(timer, ^{ snapshot(); });
        dispatch_resume(timer);
        dispatch_main();
    }
}
