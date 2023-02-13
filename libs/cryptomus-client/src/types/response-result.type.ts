export type ResponseResult<T> = {
  state: number;
  result?: T;
  message?: string;
};
