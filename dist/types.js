export class CeroneHttpError extends Error {
    kind;
    status;
    constructor(message, kind, status) {
        super(message);
        this.name = "CeroneHttpError";
        this.kind = kind;
        this.status = status;
    }
}
export class CeroneConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = "CeroneConfigError";
    }
}
