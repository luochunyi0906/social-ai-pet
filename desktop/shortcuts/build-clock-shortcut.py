"""Build the alarm shortcut plist for signing with the macOS shortcuts CLI."""
from pathlib import Path
import plistlib
import sys

TEXT_ID = '6807CE90-F44F-4332-A30F-6454022318F8'
ALARM_ID = 'FA4E297D-1680-4B3D-AF07-CE04E56CB744'
CREATE_ALARM = 'com.apple.mobiletimer-framework.MobileTimerIntents.MTCreateAlarmIntent'


def attachment(value):
    return {'Value': value, 'WFSerializationType': 'WFTextTokenAttachment'}


def text_value(name, identifier, prefix=''):
    value = {'Type': 'ActionOutput', 'OutputName': name, 'OutputUUID': identifier}
    return {
        'Value': {'string': prefix + '\ufffc',
                  'attachmentsByRange': {f'{{{len(prefix)}, 1}}': value}},
        'WFSerializationType': 'WFTextTokenString',
    }


def action(identifier, **parameters):
    return {'WFWorkflowActionIdentifier': identifier,
            'WFWorkflowActionParameters': parameters}


CLOCK_ACTION = {
    'BundleIdentifier': 'com.apple.clock',
    'Name': 'Clock',
    'AppIntentIdentifier': 'CreateAlarmIntent',
    'TeamIdentifier': '0000000000',
}


workflow = {
    'WFWorkflowClientVersion': '2600.0',
    'WFWorkflowMinimumClientVersion': 900,
    'WFWorkflowIcon': {'WFWorkflowIconStartColor': 4282601983, 'WFWorkflowIconGlyphNumber': 59716},
    'WFWorkflowTypes': [],
    'WFWorkflowHasShortcutInputVariables': True,
    'WFWorkflowInputContentItemClasses': ['WFStringContentItem', 'WFGenericFileContentItem'],
    'WFWorkflowActions': [
        action('is.workflow.actions.detect.text', WFInput=attachment({'Type': 'ExtensionInput'}), UUID=TEXT_ID),
        action(CREATE_ALARM, AppIntentDescriptor=CLOCK_ACTION, name='看山有伴',
               dateComponents=text_value('Text', TEXT_ID), ShowWhenRun=False, UUID=ALARM_ID),
        action('is.workflow.actions.gettext', WFTextActionText=text_value('Alarm', ALARM_ID, 'Alarm: ')),
    ],
}
Path(sys.argv[1]).write_bytes(plistlib.dumps(workflow, fmt=plistlib.FMT_BINARY))
