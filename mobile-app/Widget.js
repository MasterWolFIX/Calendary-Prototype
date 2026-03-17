import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

export function CalendaryWidget() {
    return (
        <FlexWidget
            style={{
                height: 'match_parent',
                width: 'match_parent',
                backgroundColor: '#07090F',
                borderRadius: 16,
                padding: 16,
            }}
        >
            <TextWidget
                text="📅 Calendary"
                style={{
                    fontSize: 14,
                    fontWeight: 'bold',
                    color: '#6366f1',
                }}
            />
            <TextWidget
                text="Najbliższe wydarzenia:"
                style={{
                    fontSize: 12,
                    color: '#64748b',
                    marginTop: 8,
                }}
            />
            <FlexWidget style={{ marginTop: 12 }}>
                <TextWidget
                    text="• Brak nadchodzących zadań"
                    style={{ fontSize: 13, color: '#e2e8f0' }}
                />
            </FlexWidget>
        </FlexWidget>
    );
}
