import { useState } from 'react';
import { AppHeaderSection } from './AppHeaderSection.js';
import { ModeSelectionSection } from './ModeSelectionSection.js';
import { VoiceCaptureSection } from './VoiceCaptureSection.js';
import { StatusBarSection } from './StatusBarSection.js';

export const Frame = (): JSX.Element => {
    const [mode, setMode] = useState<'encode' | 'decode'>('encode');

    return (
        <div className="inline-flex flex-col items-start relative bg-white border-2 border-solid border-[#ced4da]">
            <div className="relative w-[375px] h-[1080px] bg-neutral-950 border-0 border-none">
                <div className="relative h-[1080px] border-0 border-none flex flex-col">
                    <AppHeaderSection />
                    <ModeSelectionSection mode={mode} onModeChange={setMode} />
                    <VoiceCaptureSection mode={mode} />
                    <StatusBarSection />
                </div>
            </div>
        </div>
    );
};
