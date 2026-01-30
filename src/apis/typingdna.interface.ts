/****************
 * Interfaces
 ****************/

export interface ITDNABaseResponse {
    message: string;
    message_code: string;
    status: number;
}

export interface ITDNAVerifyResponse extends ITDNABaseResponse {
    success: 0 | 1;
    result: 0 | 1;
    action: 'enroll' | 'verify';
}

export interface ITDNAEnrollResponse extends ITDNABaseResponse {
    success: 0 | 1;
    result: 0 | 1;
}

export interface ITDNACheckUserResponse extends ITDNABaseResponse {
    mobilecount: number;
}

export interface ITDNADeleteUserResponse extends ITDNABaseResponse {
    deleted: number;
}

export interface ITDNAGetPostureResponse extends ITDNABaseResponse {
    positions: number[];
}

export interface ITDNAErrorCode extends ITDNABaseResponse {
    name: string;
}
