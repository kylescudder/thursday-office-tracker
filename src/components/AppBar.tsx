import {ModeToggle} from "@/components/mode-toggle.tsx";

const AppBar = () => (
    <div className="flex items-center justify-between p-4">
        <div className="flex ml-auto items-center gap-2">
            <ModeToggle />
        </div>
    </div>
);

export default AppBar;
