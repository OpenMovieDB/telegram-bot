export const splitArrayIntoPairs = (arr: any[]) => {
  if (arr.length <= 2) {
    return [arr];
  }

  const middleIndex = Math.floor(arr.length / 2);
  const leftHalf = arr.slice(0, middleIndex);
  const rightHalf = arr.slice(middleIndex);

  return [...splitArrayIntoPairs(leftHalf), ...splitArrayIntoPairs(rightHalf)];
};
