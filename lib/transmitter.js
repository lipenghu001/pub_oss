class Transmitter {
  constructor(num, tasks, func, handleSuccess, handleErr, handleEnd) {
    this.num = num; // 这个属性用来控制transmitter的数量
    this.tasks = tasks; // 这个属性是数组类型，保存任务队列
    this.func = func; // 这个函数用来实际处理异步任务
    this.index = -1; // 这个属性用来存储当前的任务指针
    this.handleSuccess = handleSuccess || function () {}; // 所有任务处理完成的回调函数
    this.len = tasks.length; // 任务的数量
    this.handleErr = handleErr || function () {}; // 任务失败的处理函数
    this.handleEnd = handleEnd || function () {}; // 所有任务执行完一次后的处理函数
    this.transmitters = []; // 这个属性用来保存当前正在执行的三个任务，随index的变化动态替换
    this.currentIndex = -1; // 这个属性用来用来当停止任务时，记录执行到的文件指针，用于后面恢复，此处没有具体用到，仅留出这个字段
    this.results = new Array(tasks.length).fill(null);
  }

  // 这个函数拆出来是十分有必要的
  // 写成这种形式，就把图片的上传过程单独封装了
  // 上传成功也好，失败也好都封装在自己的过程里
  // 对于整个对列的上传过程而言都是经历了上传并且已经结束
  handleTask = async (data, index) => {
    const { func } = this;
    try {
      const response = await func(data, index);
      this.results[index] = response;
      this.handleSuccess(response);
      return response;
    } catch (e) {
      this.results[index] = e;
      this.handleErr(e, data[index], index);
      return e;
    }
  };

  // 这里保存当前队列执行的上传任务
  // 并启动任务
  // 在上传队列没有文件的时候
  // 还会判断所有上传过程是否完成，并执行最终的回调函数
  executeTask = async (index, data, transmitterIndex) => {
    this.transmitters[transmitterIndex] = this.handleTask(data, index);
    await this.transmitters[transmitterIndex];
    if (index + 1 === this.len) {
      await Promise.all(this.transmitters);
      this.handleEnd(this.results);
    }
  };

  // 定义的每个上传队列执行的规则
  // 有任务时，执行任务并等待任务结束
  // 结束后如果文件队列中还有文件就取文件开始上传
  transmit = async (transmitterIndex) => {
    const { tasks } = this;
    let currentTask = tasks[++this.index];
    while (currentTask) {
      await this.executeTask(this.index, currentTask, transmitterIndex);
      currentTask = tasks[++this.index];
    }
  };

  // 这里同步创建上传队列
  // 并启动上传过程
  launch = () => {
    const { num } = this;
    for (let i = 0; i < num; i++) {
      this.transmit(i);
    }
  };
}

module.exports = Transmitter;