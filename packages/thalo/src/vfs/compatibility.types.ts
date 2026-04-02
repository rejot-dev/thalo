import type { IFileSystem as JustBashFileSystem, InMemoryFs, ReadWriteFs } from "just-bash";
import type { IFileSystem } from "./interface.js";

type Assert<T extends true> = T;

type JustBashInterfaceIsCompatible = Assert<JustBashFileSystem extends IFileSystem ? true : false>;

declare const inMemoryFs: InMemoryFs;
declare const readWriteFs: ReadWriteFs;

declare const justBashFileSystem: JustBashFileSystem;

const thaloFromJustBashInterface: IFileSystem = justBashFileSystem;
const thaloFromInMemoryFs: IFileSystem = inMemoryFs;
const thaloFromReadWriteFs: IFileSystem = readWriteFs;

void (true as JustBashInterfaceIsCompatible);
void thaloFromJustBashInterface;
void thaloFromInMemoryFs;
void thaloFromReadWriteFs;
