import { JSONObject, JSONValue } from "./json-types";

export type Permission = "r" | "w" | "rw" | "none";

export interface IStore {
  defaultPolicy: Permission;
  allowedToRead(key: string): boolean;
  allowedToWrite(key: string): boolean;
  read(path: string): any;
  write(path: string, value: JSONValue): JSONValue | IStore;
  writeEntries(entries: JSONObject): void;
  entries(): JSONObject;
}

export function Restrict(rights?: any): any {
  let currentValue: any;

  return (target: any, key: string) => {

    Object.defineProperty(target, key, {
      set: function (newValue: any) {
        if (!this.isInit || ['rw', 'w'].includes(rights || this.defaultPolicy)) {
            currentValue = newValue;
        } else {
          throw new Error(`No write access for ${key}`);
        }
      }, get: function () {
        if (['r', 'rw'].includes(rights || this.defaultPolicy)) {
          return currentValue;
        } else {
          throw new Error(`No read access for ${key}`);
        }
      }
    });
  }
}

export class Store implements IStore {
  defaultPolicy: Permission = "rw";

  @Restrict()
  private data: JSONObject = {};
  private isInit = false;

  allowedToRead(key: string): boolean {
    this.isInit = true;
    try {
      Reflect.get(this, key) || this.data;
      return true;
    } catch (e) {
      return false;
    }
  }

  allowedToWrite(key: string): boolean {
    this.isInit = true;
    try {
      (Reflect.has(this, key) && Reflect.set(this, key, null))
          ||Reflect.set(this, 'data', null);
      return true;
    } catch (e) {
      return false;
    }
  }

  read(path: string): any {
    this.isInit = true;
    const pathNodes = path.split(':');
    if (!pathNodes.length) {
      throw new Error("Path needed");
    }
    let currentNode: any;
    if (Reflect.has(this, pathNodes[0])) {
      currentNode = Reflect.get(this, pathNodes[0]);
      if (currentNode instanceof Store) {
        return currentNode.read(pathNodes.splice(1).join(':'));
      } else {
        return currentNode;
      }
    }

    currentNode = this.data;
    for (let node of pathNodes) {
      if (currentNode?.hasOwnProperty(node) && !Array.isArray(currentNode)) {
        currentNode = (currentNode as JSONObject)[node];
      } else {
        throw new Error("Wrong path");
      }
    }
    return currentNode;
  }

  write(path: string, value: JSONValue): JSONValue | IStore {
    this.isInit = true;
    const pathNodes = path.split(':');
    let currentNode: any;

    if (Reflect.has(this, pathNodes[0])) {
      currentNode = Reflect.get(this, pathNodes[0]);
      if (currentNode instanceof Store) {
        path = pathNodes.splice(1).join(':');
        if (path.length) {
          return currentNode.write(path, value);
        } else {
          Reflect.set(this, pathNodes[0], value);
          return this;
        }
      } else {
        Reflect.set(this, pathNodes[0], value);
        return this;
      }
    }

    currentNode = this.data;
    for (let node of pathNodes) {
      if (currentNode && typeof currentNode === 'object' && !Array.isArray(currentNode)) {
        if (pathNodes.indexOf(node) === pathNodes.length - 1) {
          currentNode[node] = value;
          return currentNode;
        }
        if (!currentNode.hasOwnProperty(node)) {
          currentNode[node] = {};
        }
        currentNode = (currentNode as JSONObject)[node];
      } else {
        throw new Error("Wrong path");
      }
    }


    return this;
  }

  writeEntries(entries: JSONObject): void {
    throw new Error("Undocumented");
  }

  entries(): JSONObject {
    throw new Error("Undocumented");
  }
}
