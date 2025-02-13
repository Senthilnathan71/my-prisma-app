export class ResponseData {
    status:boolean = true;
    data:any = {};
    message:string = '';

    reset():void {
        this.status = true;
        this.message = '';
        this.data = {}
    }
}