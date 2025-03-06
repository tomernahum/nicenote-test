
// Socket.io / server-client communication types
type DocId = string
type ActionData = string

type FullActionData = {
    actionData: ActionData
    toDocs: DocId[]
    esv: "no-encryption" // encryption scheme version
}

type Callback<PossibleMessage = undefined> = (
    status: "200" | "400" | "500",
    message?: PossibleMessage
) => void;

interface ClientToServerEvents {
    testEventC2S: (data: string) => void;

    join_room_exclusively: (roomId: string, callback: Callback) => void;
    join_room: (roomId: string, callback: Callback) => void;
    leave_room: (roomId: string, callback: Callback) => void;

    sendAction: (data: FullActionData, callback: Callback) => void;
}

interface ServerToClientEvents {
    testEventS2C: (data: string) => void;

    receiveAction: (data: FullActionData) => void;
}

interface InterServerEvents {
    // ping: () => void;
}

interface SocketData {
    // name: string;
    // age: number;
}
